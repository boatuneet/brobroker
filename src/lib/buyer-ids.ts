import { buyers, sellers } from "./demo-data";

export function getBuyerIds() {
  return buyers.map((buyer) => buyer.id);
}

export function getSellerIds() {
  return sellers.map((seller) => seller.id);
}
