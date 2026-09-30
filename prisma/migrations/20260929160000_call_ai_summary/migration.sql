-- AlterTable
ALTER TABLE "CallResult" ADD COLUMN "course" TEXT;
ALTER TABLE "CallResult" ADD COLUMN "customerName" TEXT;
ALTER TABLE "CallResult" ADD COLUMN "objections" JSONB;
ALTER TABLE "CallResult" ADD COLUMN "summaryStatus" TEXT;
ALTER TABLE "CallResult" ADD COLUMN "summaryUpdatedAt" DATETIME;
