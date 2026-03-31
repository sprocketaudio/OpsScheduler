import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import prismaClientPkg from "@prisma/client";

const { PrismaClient } = prismaClientPkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function parseAllowedEmails(value) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
  );
}

function formatDisplayName(email) {
  const localPart = email.split("@")[0] ?? "user";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function hashValue(input) {
  let hash = 0;
  for (const char of input) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateUniqueColour(seed, usedColours) {
  let hue = hashValue(seed) % 360;

  while (true) {
    const colour = `hsl(${hue} 65% 45%)`;
    if (!usedColours.has(colour)) {
      return colour;
    }
    hue = (hue + 29) % 360;
  }
}

async function main() {
  const organizationName = (process.env.SEED_ORGANIZATION_NAME ?? "OpsScheduler").trim();
  if (!organizationName) {
    throw new Error("SEED_ORGANIZATION_NAME must not be empty");
  }

  const allowedEmails = parseAllowedEmails(process.env.AUTH_ALLOWED_EMAILS ?? "");
  if (allowedEmails.length === 0) {
    throw new Error("AUTH_ALLOWED_EMAILS must contain at least one email address");
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? allowedEmails[0] ?? "").trim().toLowerCase();
  if (!adminEmail) {
    throw new Error("SEED_ADMIN_EMAIL must be set or AUTH_ALLOWED_EMAILS must include at least one email");
  }

  if (!allowedEmails.includes(adminEmail)) {
    throw new Error("SEED_ADMIN_EMAIL must exist in AUTH_ALLOWED_EMAILS");
  }

  const organization = await prisma.organization.upsert({
    where: { name: organizationName },
    update: {},
    create: {
      name: organizationName,
      defaultColour: "#2563eb",
    },
  });

  const existingUsers = await prisma.user.findMany({
    select: {
      colour: true,
    },
  });
  const usedColours = new Set(existingUsers.map((user) => user.colour));

  for (const email of allowedEmails) {
    const role = email === adminEmail ? "admin" : "user";
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        colour: true,
        name: true,
      },
    });

    const colour = existingUser?.colour ?? generateUniqueColour(email, usedColours);
    usedColours.add(colour);
    const name = existingUser?.name ?? formatDisplayName(email);

    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        colour,
        role,
        active: true,
        organizationId: organization.id,
      },
      create: {
        email,
        name,
        colour,
        role,
        active: true,
        organizationId: organization.id,
      },
    });
  }

  console.log(
    `Seed complete: organization '${organization.name}', users provisioned: ${allowedEmails.length}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
