-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'TECHNICIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'BANNED');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "ListingLocation" AS ENUM ('CARACAS', 'GUATIRE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING', 'FUNDS_LOCKED', 'DELIVERY_VERIFICATION_PENDING', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscrowEventType" AS ENUM ('DEAL_CREATED', 'FUNDS_LOCKED', 'DELIVERY_TOKEN_GENERATED', 'DELIVERY_TOKEN_EXPIRED', 'DELIVERY_CONFIRMED', 'FUNDS_RELEASED');

-- CreateEnum
CREATE TYPE "EscrowEventActor" AS ENUM ('BUYER', 'SELLER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAGO_MOVIL', 'ZELLE');

-- CreateEnum
CREATE TYPE "TopUpRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "isKycVerified" BOOLEAN NOT NULL DEFAULT false,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pushToken" TEXT,
    "nexoPoints" INTEGER NOT NULL DEFAULT 0,
    "profileImageUrl" TEXT,
    "kycDocumentUrl" TEXT,
    "kycProviderRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "ListingType" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "category" TEXT NOT NULL,
    "location" "ListingLocation" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceAmount" DECIMAL(12,2) NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER,
    "serviceUnit" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'PENDING',
    "agreedAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "eventType" "EscrowEventType" NOT NULL,
    "fromStatus" "DealStatus",
    "toStatus" "DealStatus" NOT NULL,
    "actorType" "EscrowEventActor" NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryToken" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFeedback" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopUpRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "TopUpRequestStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "receiptUrl" TEXT NOT NULL,
    "paymentRef" TEXT,
    "notes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopUpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Listing_ownerId_status_idx" ON "Listing"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Listing_type_status_idx" ON "Listing"("type", "status");

-- CreateIndex
CREATE INDEX "Listing_location_category_idx" ON "Listing"("location", "category");

-- CreateIndex
CREATE INDEX "Deal_listingId_status_idx" ON "Deal"("listingId", "status");

-- CreateIndex
CREATE INDEX "Deal_buyerId_status_idx" ON "Deal"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Deal_sellerId_status_idx" ON "Deal"("sellerId", "status");

-- CreateIndex
CREATE INDEX "EscrowEvent_dealId_createdAt_idx" ON "EscrowEvent"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "EscrowEvent_eventType_createdAt_idx" ON "EscrowEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryToken_tokenHash_key" ON "DeliveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DeliveryToken_dealId_createdAt_idx" ON "DeliveryToken"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryToken_expiresAt_idx" ON "DeliveryToken"("expiresAt");

-- CreateIndex
CREATE INDEX "DealFeedback_toUserId_rating_idx" ON "DealFeedback"("toUserId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "DealFeedback_dealId_fromUserId_key" ON "DealFeedback"("dealId", "fromUserId");

-- CreateIndex
CREATE INDEX "TopUpRequest_userId_status_idx" ON "TopUpRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "TopUpRequest_status_createdAt_idx" ON "TopUpRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEvent" ADD CONSTRAINT "EscrowEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryToken" ADD CONSTRAINT "DeliveryToken_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFeedback" ADD CONSTRAINT "DealFeedback_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopUpRequest" ADD CONSTRAINT "TopUpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
