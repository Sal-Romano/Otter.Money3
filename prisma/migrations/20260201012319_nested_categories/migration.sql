-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- Update depth for existing categories based on parent relationships
-- Level 0: root categories (no parent)
UPDATE "Category" SET depth = 0 WHERE "parentId" IS NULL;

-- Level 1: direct children of root categories
UPDATE "Category" c1
SET depth = 1
FROM "Category" c2
WHERE c1."parentId" = c2.id AND c2."parentId" IS NULL;

-- Level 2: grandchildren (children of level 1)
UPDATE "Category" c1
SET depth = 2
FROM "Category" c2
WHERE c1."parentId" = c2.id AND c2.depth = 1;

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_type_depth_idx" ON "Category"("type", "depth");
