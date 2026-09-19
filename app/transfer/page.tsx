import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { WardrobeTransfer } from '@/components/wardrobe-transfer';

export const dynamic = 'force-dynamic';
export default async function TransferPage() {
  await requireChatGPTUser('/transfer');
  return <WardrobeTransfer/>;
}
