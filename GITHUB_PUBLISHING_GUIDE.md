# GitHub'a Çetele Projesini Paylaşma Rehberi

Bu rehber, Çetele projesini GitHub'da paylaşmak için gereken tüm adımları açıklar.

## 1. Hazırlık Aşaması

### 1.1 Bilgilerinizi Güncelle

**package.json dosyasını düzenle:**
```json
"author": {
  "name": "Adınız",
  "email": "email@example.com"
},
"repository": {
  "type": "git",
  "url": "https://github.com/kullaniciadi/cetele.git"
}
```

**app.json dosyasını düzenle:**
```json
"owner": "kullaniciadi"
```

**LICENSE dosyasını düzenle:**
- `Copyright (c) 2025 Your Name` kısmını kendi adınızla değiştir

### 1.2 Projeyi Kontrol Et

Tüm dosyaların doğru olduğundan emin ol:
```bash
# Lint kontrolü
npm run lint

# TypeScript kontrolü
npm run typecheck

# Bağımlılıkları kontrol et
npm list
```

### 1.3 .env Dosyasını Kontrol Et

`.env` dosyasını paylaşmamaya özen göster:
- `.env` dosyası `.gitignore`'da olmalı (zaten var)
- `.env.example` oluştur (geçerli olmayan değerlerle):
```
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_API_KEY=your_api_key_here
```

## 2. GitHub Hesabı Ayarı

### 2.1 GitHub'da Repo Oluştur

1. GitHub'da oturum aç: https://github.com/login
2. "+" simgesine tıkla → "New repository"
3. Repo ayarları:
   - **Repository name**: `cetele`
   - **Description**: "A beautiful note-taking application with rich text editing and biometric authentication"
   - **Public** seç (açık kaynak için)
   - **.gitignore**: Node seç
   - **License**: MIT License seç
   - "Create repository" tıkla

### 2.2 SSH Key Ayarı (İsteğe bağlı ancak önerilir)

SSH ile push yapmak daha güvenli:

```bash
# SSH key oluştur (henüz yoksa)
ssh-keygen -t ed25519 -C "email@example.com"

# Anahtar dosyasını göster (~/.ssh/id_ed25519.pub)
cat ~/.ssh/id_ed25519.pub
```

GitHub ayarlarına ekle:
1. GitHub → Settings → SSH and GPG keys
2. "New SSH key" tıkla
3. Public key'i yapıştır

## 3. Projeyi GitHub'a Upload Etme

### 3.1 Terminal'de Proje Dizinine Git

```bash
cd /path/to/cetele
```

### 3.2 Git'i Başlat ve Repo'yu Bağla

```bash
# Repo'u başlat (eğer git init yapılmamışsa)
git init

# User bilgilerini ayarla (ilk defa yapılıyorsa)
git config user.name "Adınız"
git config user.email "email@example.com"

# Bütün değişiklikleri staging alanına ekle
git add .

# İlk commit'i yap
git commit -m "Initial commit: Add Çetele note-taking application"

# Main branch'ine geçiş yap
git branch -M main

# Remote repo'yu bağla (HTTPS veya SSH)
# HTTPS:
git remote add origin https://github.com/kullaniciadi/cetele.git

# VEYA SSH:
git remote add origin git@github.com:kullaniciadi/cetele.git

# Master branch'i main'e çevir
git remote set-url origin git@github.com:kullaniciadi/cetele.git

# Push et
git push -u origin main
```

### 3.3 Push Sonrası Kontrol

GitHub'da repo'u açarak her şeyin doğru yüklendiğini kontrol et:
- README.md gösteriliyor mu?
- LICENSE dosyası var mı?
- Tüm kodlar görünüyor mu?
- .env dosyası yoksa tamam!

## 4. GitHub Repo Ayarlarını Optimize Et

### 4.1 Repository Description ve Topics

GitHub repo sayfasında:
1. "About" başlığının yanındaki dişli simgesine tıkla
2. Bilgileri güncelle:
   - **Description**: "A beautiful note-taking application with rich text editing and biometric authentication"
   - **Topics**: Ekle: `react-native`, `expo`, `note-taking`, `nostr`, `biometric-auth`
   - **Website** (varsa): Herkese açık link

### 4.2 Branch Protection Rules (İsteğe bağlı)

1. Settings → Branches
2. "Add rule" tıkla
3. Branch name pattern: `main`
4. İstediğin proteksiyonları seç

## 5. README Geliştirme

README.md dosyasını zenginleştir:

```markdown
# Bölüm Ekleri:

## Demo
- [Live Demo Link](https://your-demo-link.com)
- Ekran görüntüleri ekle

## Screenshots
```markdown
| Feature | Screenshot |
|---------|------------|
| Home    | ![](screenshots/home.png) |
| Editor  | ![](screenshots/editor.png) |
```

## Frequently Asked Questions (FAQ)
- Sık sorulan sorulara cevaplar

## Roadmap
- Gelecek özellikler
- İyileştirmeler

## Performance
- Build time
- App size
- Memory usage
```

## 6. GitHub Pages ile Dokumentasyon (İsteğe bağlı)

Daha detaylı dokumentasyon için:

1. `docs/` dizini oluştur
2. GitHub Settings → Pages
3. Source olarak `docs` klasörünü seç
4. Otomatik olarak web sayfası oluşturulacak

## 7. Release Yayınlama

### 7.1 İlk Release'i Oluştur

```bash
# Release numarası ekle
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

### 7.2 GitHub Releases'ta Duyur

1. GitHub repo → "Releases"
2. "Create a new release" tıkla
3. Tag'i seç: `v1.0.0`
4. Release başlığı ve açıklamasını yaz:

```markdown
## Features
- Rich text editing with markdown support
- Biometric authentication
- Nostr protocol integration
- Cross-platform support

## What's New
- Initial release
- All core features implemented

## Installation
See README.md for detailed instructions

## Known Issues
- None reported
```

5. "Publish release" tıkla

## 8. Continuous Integration (İsteğe bağlı - GitHub Actions)

### 8.1 Otomatik Test İçin Workflow Oluştur

`.github/workflows/ci.yml` dosyası oluştur:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install

    - name: Run linter
      run: npm run lint

    - name: Type check
      run: npm run typecheck

    - name: Build web
      run: npm run build:web
```

## 9. Sosyal Medya ve Haberler

### 9.1 Proje Duyurusu Yap

- Twitter/X, Reddit, Dev.to vb. platformlarda share et
- Açık kaynak topluluklarına göz at (GitHub, ProductHunt vb.)

### 9.2 Profile'ı Düzenle

GitHub profile'ında:
- Biyografi ekle
- Popüler repo'ları sabitle
- Sosyal medya linklerini ekle

## 10. Bakım ve Güncellemeler

### 10.1 Repository'i Aktif Tutma

```bash
# Düzenli olarak commit yap
git add .
git commit -m "Update feature"
git push origin main

# Issues ve Pull Requests'e cevap ver
# Yıldız alanlar için teşekkür et
```

### 10.2 Changelog Tut

`CHANGELOG.md` dosyası oluştur:

```markdown
# Changelog

## [1.0.0] - 2025-01-11
### Added
- Initial release
- Rich text editing
- Biometric authentication
- Nostr integration

### Fixed
- Rich text rendering display

### Changed
- Updated RichTextRenderer for clean output
```

### 10.3 Düzenli Güncellemeler

```bash
# Version bump
npm version minor  # 1.0.0 → 1.1.0
npm version patch  # 1.0.0 → 1.0.1

# Tag ve push
git push origin main --tags
```

## 11. Katkılar Kabulü

### 11.1 CONTRIBUTING.md Oluştur

Projeye katkı vermek isteyenler için rehber:

```markdown
# Contributing to Çetele

Thank you for your interest in contributing!

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style
- Use TypeScript
- Follow existing patterns
- Add comments for complex logic
- Run lint before committing

## Reporting Issues
- Check if issue already exists
- Provide reproduction steps
- Include error messages
```

### 11.2 PR Template

`.github/pull_request_template.md` oluştur:

```markdown
## Description
Kısa açıklama...

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have run lint
- [ ] I have tested my changes
```

## 12. Güvenlik Ayarları

### 12.1 Branch Protection

Settings → Branches → main:
- Require pull request reviews
- Require status checks
- Require branches to be up to date

### 12.2 Secret Management

Asla yapmayacakları:
- API keys'i commit etme
- Private keys'i açıkla
- Şifreleri repo'ya koymayın
- `.gitignore` kontrol et

## 13. Performans İzleme

- GitHub Insights kullan
- Traffic istatistiklerini izle
- Popular repositories'de ranking'ini takip et

## 14. Lisans ve Hukuk

- MIT License seçimi yapıldı
- CONTRIBUTORS.md oluştur (isteğe bağlı)
- Telif hakkı bilgilerini belirtir

## Son Kontrol Listesi

- [ ] package.json güncellendi
- [ ] app.json güncellendi
- [ ] LICENSE dosyası var
- [ ] README.md yazıldı
- [ ] .env dosyası .gitignore'da
- [ ] Node_modules push edilmedi
- [ ] Tüm kodlar lint'e geçti
- [ ] GitHub repo oluşturuldu
- [ ] Kod push edildi
- [ ] Release oluşturuldu
- [ ] Topics ve açıklama eklendi

---

**Tebrikler! Projen şimdi GitHub'da canlı!** 🎉

Sorular için: [GitHub Help](https://docs.github.com)
