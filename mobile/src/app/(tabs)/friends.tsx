import { NeedsAccount } from "@/components/NeedsAccount";

export default function FriendsScreen() {
  return (
    <NeedsAccount
      title="Друзья"
      text="Друзья и общие дела работают через аккаунт Uspeyka."
      points={["совместные дела и списки покупок", "добавление по нику или QR-коду", "те же друзья, что на сайте"]}
    />
  );
}
