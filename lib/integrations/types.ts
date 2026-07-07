export type AuctionSearchResult = {
  source: 'COPART' | 'IAA' | 'MANHEIM';
  lotNumber: string;
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  title?: string;
  currentBid?: number;
  buyNowPrice?: number;
  saleDate?: string;
};

export type MarketplacePostInput = {
  title: string;
  description: string;
  price?: number;
  vin?: string;
};

export type MarketplacePostResult = {
  externalId: string;
  status: 'POSTED' | 'FAILED';
  url?: string;
  errorMessage?: string;
};
