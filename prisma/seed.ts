import { PrismaClient, CategoryType } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '@otter-money/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default system categories
  const categoryTypes: CategoryType[] = ['INCOME', 'EXPENSE', 'TRANSFER'];

  for (const type of categoryTypes) {
    const categories = DEFAULT_CATEGORIES[type];
    for (const cat of categories) {
      await prisma.category.upsert({
        where: {
          householdId_name: {
            householdId: null as unknown as string, // System categories have no household
            name: cat.name,
          },
        },
        update: {},
        create: {
          name: cat.name,
          type,
          icon: cat.icon,
          isSystem: true,
          householdId: null,
        },
      });
    }
  }

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
