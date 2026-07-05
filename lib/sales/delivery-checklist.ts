export type DeliveryChecklistItem = { id: string; label: string; completed: boolean };

const STANDARD_DELIVERY_ITEMS = [
  'Purchase agreement signed',
  'Buyer disclosures signed',
  'Financing paperwork completed',
  'Trade-in paperwork completed (if applicable)',
  'Title/registration paperwork submitted',
  'Keys and fobs provided (count confirmed)',
  'Spare tire / roadside kit confirmed',
  'Floor mats confirmed',
  'Fuel level noted at delivery',
  'Final vehicle wash/detail completed',
  'Owner walkthrough of features completed'
];

/** Builds the standard delivery checklist for a new sale. Completion
 * state is persisted on Sale.deliveryChecklist and merged back in on
 * subsequent reads, so previously checked items stay checked. */
export function buildDeliveryChecklist(existing?: DeliveryChecklistItem[] | null): DeliveryChecklistItem[] {
  const completedIds = new Set((existing ?? []).filter((item) => item.completed).map((item) => item.id));
  return STANDARD_DELIVERY_ITEMS.map((label, index) => {
    const id = `item-${index + 1}`;
    return { id, label, completed: completedIds.has(id) };
  });
}
