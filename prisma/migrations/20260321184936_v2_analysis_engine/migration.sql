-- AlterTable
ALTER TABLE "DailySummary" ADD COLUMN     "bearCase" TEXT,
ADD COLUMN     "bist100Change" DOUBLE PRECISION,
ADD COLUMN     "bullCase" TEXT,
ADD COLUMN     "compositeScore" DOUBLE PRECISION,
ADD COLUMN     "confidence" TEXT,
ADD COLUMN     "relativeStrength" DOUBLE PRECISION,
ADD COLUMN     "sectorChange" DOUBLE PRECISION,
ADD COLUMN     "sectorCode" TEXT,
ADD COLUMN     "sentimentValue" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "TechnicalSnapshot" (
    "id" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "closePrice" DOUBLE PRECISION,
    "rsi14" DOUBLE PRECISION,
    "ma20" DOUBLE PRECISION,
    "ma50" DOUBLE PRECISION,
    "ma200" DOUBLE PRECISION,
    "ema12" DOUBLE PRECISION,
    "ema26" DOUBLE PRECISION,
    "macdLine" DOUBLE PRECISION,
    "macdSignal" DOUBLE PRECISION,
    "macdHistogram" DOUBLE PRECISION,
    "bbUpper" DOUBLE PRECISION,
    "bbMiddle" DOUBLE PRECISION,
    "bbLower" DOUBLE PRECISION,
    "bbWidth" DOUBLE PRECISION,
    "bbPercentB" DOUBLE PRECISION,
    "atr14" DOUBLE PRECISION,
    "stochK" DOUBLE PRECISION,
    "stochD" DOUBLE PRECISION,
    "obv" DOUBLE PRECISION,
    "obvMa20" DOUBLE PRECISION,
    "adx14" DOUBLE PRECISION,
    "plusDI" DOUBLE PRECISION,
    "minusDI" DOUBLE PRECISION,
    "volume" BIGINT,
    "volumeAvg20" DOUBLE PRECISION,
    "volumeRatio" DOUBLE PRECISION,
    "supportLevel" DOUBLE PRECISION,
    "resistLevel" DOUBLE PRECISION,
    "technicalScore" DOUBLE PRECISION,
    "momentumScore" DOUBLE PRECISION,
    "volumeScore" DOUBLE PRECISION,
    "volatilityScore" DOUBLE PRECISION,
    "compositeScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "signalType" TEXT NOT NULL,
    "signalDirection" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "priceAtSignal" DOUBLE PRECISION,
    "priceAfter1Day" DOUBLE PRECISION,
    "priceAfter5Days" DOUBLE PRECISION,
    "priceAfter10Days" DOUBLE PRECISION,
    "outcomePercent1D" DOUBLE PRECISION,
    "outcomePercent5D" DOUBLE PRECISION,
    "outcomePercent10D" DOUBLE PRECISION,
    "wasAccurate" BOOLEAN,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectorSnapshot" (
    "id" TEXT NOT NULL,
    "sectorCode" TEXT NOT NULL,
    "sectorName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SectorSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicalSnapshot_stockCode_idx" ON "TechnicalSnapshot"("stockCode");

-- CreateIndex
CREATE INDEX "TechnicalSnapshot_date_idx" ON "TechnicalSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalSnapshot_stockCode_date_key" ON "TechnicalSnapshot"("stockCode", "date");

-- CreateIndex
CREATE INDEX "Signal_stockCode_idx" ON "Signal"("stockCode");

-- CreateIndex
CREATE INDEX "Signal_date_idx" ON "Signal"("date");

-- CreateIndex
CREATE INDEX "Signal_signalType_idx" ON "Signal"("signalType");

-- CreateIndex
CREATE INDEX "Signal_stockCode_date_idx" ON "Signal"("stockCode", "date");

-- CreateIndex
CREATE INDEX "SectorSnapshot_date_idx" ON "SectorSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SectorSnapshot_sectorCode_date_key" ON "SectorSnapshot"("sectorCode", "date");
