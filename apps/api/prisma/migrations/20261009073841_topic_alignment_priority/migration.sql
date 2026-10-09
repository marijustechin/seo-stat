-- AlterTable
ALTER TABLE "content_topics" ADD COLUMN     "objective_alignment" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'supporting';
