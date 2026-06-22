# Publicação (Capacitor + Codemagic) 📱

O Quantum é um web app (Vite/React) **empacotado em app nativo** pelo
[Capacitor](https://capacitorjs.com/). O [Codemagic](https://codemagic.io)
constrói o APK/AAB na nuvem (não precisa de Android Studio na sua máquina).

- `capacitor.config.json` — id e nome do app.
- `android/` — projeto Android nativo (commitado; as assets web entram no build via `cap sync`).
- `codemagic.yaml` — 2 workflows: **android-test** (APK de teste) e **android-release** (AAB assinado).

---

## 1. Testar no celular (APK de debug) — funciona de cara

1. Crie conta no [codemagic.io](https://codemagic.io) e **conecte o repositório** GitHub `XxMdePaula10xX/Quantum`.
2. O Codemagic detecta o `codemagic.yaml`. Rode o workflow **"Quantum · APK de teste (debug)"** no branch atual.
3. Ao terminar, baixe o `.apk` dos artefatos (ou pelo e-mail).
4. No Android: copie o APK pro celular, toque nele e permita "instalar apps de fonte desconhecida". Pronto, app instalado. 🎉

> Esse APK de debug **não precisa de assinatura nem keystore** — é só pra testar o app de verdade no aparelho.

---

## 2. Ligar login/ranking no app empacotado (opcional)

O build lê as chaves do Firebase de variáveis de ambiente. No Codemagic:

1. **Teams/App settings → Environment variables.**
2. Crie um grupo chamado **`firebase`** e adicione (marque "Secure"):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   (os mesmos valores do seu `.env` local)
3. No `codemagic.yaml`, no workflow **android-test**, descomente:
   ```yaml
   #     groups:
   #       - firebase
   ```
4. **Authentication → Settings → Authorized domains** no Firebase: adicione o domínio do app empacotado. Para Capacitor Android o app roda em `https://localhost` — adicione `localhost` aos domínios autorizados, senão o login pode ser bloqueado.

Sem isso, o app empacotado funciona offline (jogo local), só sem login/ranking.

---

## 3. Publicar na Play Store (AAB assinado)

### 3.1 Defina o ID do app ANTES de publicar ⚠️
`appId` é **permanente** na loja. Hoje está `com.quantum.quiz` (provisório). Para
trocar pelo seu definitivo (ex.: `com.seunome.quantum`), edite `capacitor.config.json`,
apague a pasta `android/` e rode `npx cap add android` de novo (ou troque
`applicationId`/`namespace` em `android/app/build.gradle` e o `package_name` em
`android/app/src/main/res/values/strings.xml`).

### 3.2 Gere a keystore (assinatura) — uma vez, guarde bem
```bash
keytool -genkey -v -keystore quantum.keystore -alias quantum -keyalg RSA -keysize 2048 -validity 10000
```
Guarde o arquivo `quantum.keystore` e as senhas em local seguro (perdeu = não
consegue mais atualizar o app publicado).

### 3.3 Configure a assinatura no Codemagic
1. **App settings → Code signing → Android.**
2. Faça upload do `quantum.keystore`, informe as senhas e o alias.
3. Dê a esse keystore o **reference name `quantum_keystore`** (é o nome usado no `codemagic.yaml`).

O `android/app/build.gradle` já está pronto: ele assina o release automaticamente
quando o Codemagic injeta a keystore (variáveis `CM_*`).

### 3.4 Rode o release e suba na loja
1. Rode o workflow **"Quantum · AAB assinado (Play Store)"** → baixe o `.aab`.
2. Crie a conta no [Google Play Console](https://play.google.com/console) (US$ 25, uma vez).
3. Crie o app, preencha a ficha (ícone, descrição, política de privacidade — exigida por causa do login/LGPD) e faça upload do `.aab`.
4. A cada nova versão, aumente `versionCode` (e `versionName`) em `android/app/build.gradle`.

> Dá pra automatizar o upload direto pra Play Store pelo Codemagic (Google Play
> publishing com uma service account), mas no começo subir o `.aab` na mão é mais simples.

---

## 4. iOS (depois)

Precisa de **Mac + Xcode + conta Apple Developer (US$ 99/ano)**. Num Mac:
```bash
npm i @capacitor/ios
npx cap add ios
```
Depois dá pra adicionar um workflow iOS no Codemagic (instâncias macOS). Fica para
quando o Android estiver no ar.

---

## Ícone e splash (recomendado antes de publicar)
Gere ícones/splash a partir de uma imagem com:
```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --android
```
(coloque um `resources/icon.png` 1024×1024 e `resources/splash.png` 2732×2732).

---

## Resumo do ciclo de atualização
1. Mexeu no código/base → `git push`.
2. Codemagic rebuilda (web + Capacitor + Android).
3. Baixa o APK (teste) ou AAB (loja). Para a loja, suba o AAB e aumente o `versionCode`.
