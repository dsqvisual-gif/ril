import { FriendsPanel } from "@/components/FriendsPanel";
import { getFriendsBoard } from "@/lib/actions/friends";

export default async function FriendsPage() {
  const board = await getFriendsBoard();
  return <FriendsPanel initial={board} />;
}
