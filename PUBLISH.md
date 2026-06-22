# Publicação (Capacitor + Codemagic) 📱

O Quantum é um web app (Vite/React) **empacotado em app nativo** pelo
[Capacitor](https://capacitorjs.com/). O [Codemagic](https://codemagic.io)
constrói o app na nuvem (não precisa de Mac nem Android Studio na sua máquina).

- `capacitor.config.json` — id e nome do app.
- `ios/` e `android/` — projetos nativos (commitados; as assets web entram no build via `cap sync`).
- `codemagic.yaml` — workflows de **iOS** (simulador / TestFlight) e **Android** (APK de teste / AAB).

> ⚠️ **iOS x Android — diferença importante de teste:**
> No **Android** dá pra instalar um APK direto no celular, de graça.
> No **iOS** a Apple **não** permite sideload: para rodar no iPhone você precisa de
> **conta Apple Developer (US$ 99/ano)** e instalar via **TestFlight**. Não existe
> "APK de debug" no iOS. (Por isso, para só _testar rápido_, o Android é mais fácil;
> mas para publicar na App Store, siga o iOS abaixo.)

---

## 🍏 iOS (foco)

Capacitor 8 usa **Swift Package Manager** — sem CocoaPods. Bundle id atual:
`com.matheus.quantum` (provisório — troque antes de publicar, é permanente).

### Passo 0 — sanity check grátis (compila no iOS?)
Sem gastar nada nem ter conta Apple, rode no Codemagic o workflow
**"Quantum · iOS (build de simulador, sem assinatura)"**. Ele confirma que o app
**compila** no iOS (build de simulador). Não gera nada instalável no iPhone, mas
valida o pipeline. Bom primeiro passo.

### Passo 1 — conta Apple Developer
Inscreva-se no [Apple Developer Program](https://developer.apple.com/programs/)
(US$ 99/ano). É obrigatório para rodar no iPhone e publicar.

### Passo 2 — registrar o app na App Store Connect
1. Em [App Store Connect](https://appstoreconnect.apple.com) → **Apps → +** → novo app.
2. Use o **Bundle ID** `com.matheus.quantum` (crie o identificador no
   [Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list) antes).

### Passo 3 — assinatura automática no Codemagic (App Store Connect API key)
1. Em App Store Connect → **Users and Access → Integrations → App Store Connect API**
   → gere uma chave (role "App Manager"). Baixe o arquivo `.p8` (só dá pra baixar uma vez).
2. No Codemagic → **Teams → Integrations → App Store Connect → Connect**: suba o `.p8`,
   o Issuer ID e o Key ID. **Dê a essa integração o nome `quantum_asc`** (usado no `codemagic.yaml`).
3. O `codemagic.yaml` já está pronto (`ios_signing` automático + `integrations: app_store_connect`).

### Passo 4 — build e TestFlight
1. (Opcional) crie o grupo de variáveis `firebase` (ver seção Firebase) para ligar login/ranking.
2. Rode o workflow **"Quantum · iOS (TestFlight)"**. Ele gera o `.ipa` assinado e
   **envia pro TestFlight** automaticamente.
3. No iPhone, instale o app **TestFlight** (App Store) e aceite o convite — pronto, app rodando. 🎉

### Passo 5 — publicar na App Store
Quando estiver feliz, em App Store Connect preencha a ficha (ícone, capturas,
**política de privacidade** — exigida por causa do login/LGPD) e envie para revisão.

### Trocar o Bundle ID (antes de publicar)
É **permanente** na loja. Para trocar: edite `appId` no `capacitor.config.json`,
apague a pasta `ios/` e rode `npx cap add ios` (ou troque `PRODUCT_BUNDLE_IDENTIFIER`
no Xcode). Faça o mesmo no `bundle_identifier` do `codemagic.yaml`.

---

## 🤖 Android (mais fácil de testar)

### Teste no celular (APK de debug) — funciona de cara
1. No Codemagic, rode **"Quantum · APK de teste (debug)"**.
2. Baixe o `.apk`, copie pro celular, instale (permita "fonte desconhecida"). 🎉
   Sem keystore, sem custo.

### Publicar na Play Store (AAB assinado)
1. Gere a keystore (guarde bem — perdeu, não atualiza mais o app):
   ```bash
   keytool -genkey -v -keystore quantum.keystore -alias quantum -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Codemagic → **Code signing → Android**: suba a keystore com o reference name `quantum_keystore`.
3. Rode **"Quantum · AAB assinado (Play Store)"** → `.aab`.
4. [Play Console](https://play.google.com/console) (US$ 25, uma vez) → crie o app → suba o `.aab`.
5. A cada versão, aumente `versionCode`/`versionName` em `android/app/build.gradle`.

Para trocar o appId (permanente): `capacitor.config.json` + `applicationId`/`namespace`
em `android/app/build.gradle` + `package_name` em `strings.xml`.

---

## 🔥 Firebase no app empacotado (login/ranking) — opcional

O build lê as chaves de variáveis de ambiente. No Codemagic:
1. **Environment variables** → crie o grupo **`firebase`** com as `VITE_FIREBASE_*`
   (mesmos valores do seu `.env`), marcadas como "Secure".
2. Nos workflows que ainda não referenciam, descomente `groups: - firebase`.
3. Login por e-mail/senha funciona no app empacotado sem config extra. (Os modos
   offline funcionam mesmo sem Firebase.)

---

## 🎨 Ícone e splash (antes de publicar)
```bash
npm i -D @capacitor/assets
# coloque resources/icon.png (1024×1024) e resources/splash.png (2732×2732)
npx capacitor-assets generate
```
Gera ícones/splash para iOS e Android automaticamente.

---

## 🔁 Ciclo de atualização
1. Mexeu no código/base → `git push`.
2. Codemagic rebuilda (web + Capacitor + nativo).
3. iOS: novo build TestFlight/App Store (aumente o build em `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`).
   Android: novo AAB (aumente `versionCode`).
