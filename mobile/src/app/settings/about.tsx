import { Linking } from "react-native";
import { SettingsGroup, SettingsRow, SettingsScreen } from "@/components/settings/SettingsUI";

const SITE = "https://www.uspeyka.com";

export default function AboutSettings() {
  return (
    <SettingsScreen title="Помощь и документы" lead="Документы открываются на сайте uspeyka.com.">
      <SettingsGroup title="Документы">
        <SettingsRow icon="🔐" tone="#eceef3" title="Политика конфиденциальности" onPress={() => void Linking.openURL(`${SITE}/privacy`)} />
        <SettingsRow icon="📄" tone="#eceef3" title="Правила использования" onPress={() => void Linking.openURL(`${SITE}/terms`)} />
        <SettingsRow icon="🛡️" tone="#eceef3" title="Безопасность" onPress={() => void Linking.openURL(`${SITE}/security`)} last />
      </SettingsGroup>
      <SettingsGroup title="Связь">
        <SettingsRow icon="✉️" tone="#dff1ff" title="Написать нам" value="support@uspeyka.com" onPress={() => void Linking.openURL("mailto:support@uspeyka.com")} last />
      </SettingsGroup>
    </SettingsScreen>
  );
}
