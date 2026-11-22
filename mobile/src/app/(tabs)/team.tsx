import { NeedsAccount } from "@/components/NeedsAccount";

export default function TeamScreen() {
  return (
    <NeedsAccount
      title="Команда"
      text="Команды работают через аккаунт Uspeyka — так все участники видят одни и те же задачи."
      points={["задачи с исполнителями и сроками", "график команды", "приглашения по нику"]}
    />
  );
}
