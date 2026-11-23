import { Linking } from "react-native";
import { SettingsGroup, SettingsRow, SettingsScreen } from "@/components/settings/SettingsUI";

const SITE = "https://www.uspeyka.com";

export default function AboutSettings() {
  return (
    <SettingsScreen title="Помощь и документы" lead="Документы открываются на сайте uspeyka.com.">
      <SettingsGroup title="Документы">
        <SettingsRow icon="lock-closed-outline" tone="#5f6b7a" title="Политика конфиденциальности" onPress={() => void Linking.openURL(`${SITE}/privacy`)} />
        <SettingsRow icon="document-text-outline" tone="#5f6b7a" title="Правила использования" onPress={() => void Linking.openURL(`${SITE}/terms`)} />
        <SettingsRow icon="shield-checkmark-outline" tone="#5f6b7a" title="Безопасность" onPress={() => void Linking.openURL(`${SITE}/security`)} last />
      </SettingsGroup>
      <SettingsGroup title="Связь">
        <SettingsRow icon="mail-outline" tone="#0a84ff" title="Написать нам" value="support@uspeyka.com" onPress={() => void Linking.openURL("mailto:support@uspeyka.com")} last />
      </SettingsGroup>
    </SettingsScreen>
  );
}
