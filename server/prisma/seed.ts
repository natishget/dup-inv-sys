import { PrismaClient, CostingMethodName } from '@prisma/client';

const prisma = new PrismaClient();

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
      console.log(`Initialized system_settings with default costing method: ${defaultMethod.name}`);
    } else {
      console.log('system_settings already exists, skipping creation.');
    }
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
