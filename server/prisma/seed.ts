import { PrismaClient, CostingMethodName, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

async function main() {
  console.log('Seeding initial system records...');

  // 1. Seed Costing Methods
  const costingMethods = [
    { name: CostingMethodName.FIFO },
    { name: CostingMethodName.LIFO },
    { name: CostingMethodName.WEIGHTED_AVERAGE },
  ];

  for (const method of costingMethods) {
    await prisma.costingMethod.upsert({
      where: { name: method.name },
      update: {},
      create: { name: method.name },
    });
  }

  // 2. Fetch default method (FIFO) to set active_costing_method in system_settings
  const defaultMethod = await prisma.costingMethod.findUnique({
    where: { name: CostingMethodName.FIFO },
  });

  if (defaultMethod) {
    const existingSetting = await prisma.systemSetting.findFirst();
    if (!existingSetting) {
      await prisma.systemSetting.create({
        data: {
          activeCostingMethodId: defaultMethod.id,
        },
      });
      console.log(
        `Initialized system_settings with default costing method: ${defaultMethod.name}`,
      );
    } else {
      console.log('system_settings already exists, skipping creation.');
    }
  }

  // 3. Seed Default RBAC Users (ADMIN, SALES, AUDITOR)
  const usersToSeed = [
    {
      name: 'Natnael Getachew',
      email: 'natishget@gmail.com',
      phone: '+251911000000',
      role: UserRole.ADMIN,
      password: 'AdminPassword123!',
    },
    {
      name: 'System Administrator',
      email: 'admin@inventory.local',
      phone: '+251911000001',
      role: UserRole.ADMIN,
      password: 'AdminPassword123!',
    },
    {
      name: 'Sales Manager',
      email: 'sales@inventory.local',
      phone: '+251911000002',
      role: UserRole.SALES,
      password: 'SalesPassword123!',
    },
    {
      name: 'Compliance Auditor',
      email: 'auditor@inventory.local',
      phone: '+251911000003',
      role: UserRole.AUDITOR,
      password: 'AuditorPassword123!',
    },
  ];

  for (const userData of usersToSeed) {
    const hashedPassword = await hashPassword(userData.password);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        role: userData.role,
        isActive: true,
      },
      create: {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        isActive: true,
        password: hashedPassword,
      },
    });
    console.log(`Seeded user: ${user.email} (${user.role})`);
  }

  // 4. Seed 'Main' Warehouse
  let mainWarehouse = await prisma.warehouse.findFirst({
    where: { name: 'Main' },
  });
  if (!mainWarehouse) {
    mainWarehouse = await prisma.warehouse.create({
      data: {
        name: 'Main',
        location: 'Addis Ababa Central Facility',
      },
    });
    console.log(`Seeded warehouse: ${mainWarehouse.name} (${mainWarehouse.id})`);
  } else {
    console.log(`Warehouse "${mainWarehouse.name}" already exists.`);
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
