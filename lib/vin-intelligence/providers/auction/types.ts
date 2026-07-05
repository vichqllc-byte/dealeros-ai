export type AuctionHouseName = 'Copart' | 'IAAI' | 'Auto Auction Services' | 'Other';

export type AuctionLot = {
  lotNumber: string;
  vin: string;
  auctionHouse: AuctionHouseName;
  saleDate: string | null;
  primaryDamage: string | null;
  secondaryDamage: string | null;
  titleType: string | null;
  odometer: number | null;
  location: string | null;
  currentBid: number | null;
};

/**
 * Copart and IAAI do not offer a free public VIN-search API - their live
 * inventory search sits behind a licensed buyer-member portal. Building a
 * scraper against that portal would be a ToS violation and is out of
 * scope; this adapter boundary is shaped for a real licensed buyer/data
 * API if the dealer has one, not a scraper.
 */
export interface AuctionInventoryProvider {
  readonly name: AuctionHouseName;
  isAvailable(): boolean;
  searchByVin(vin: string): Promise<AuctionLot[]>;
}
