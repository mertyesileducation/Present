# Present

**Sürüm 1.0.0** — Tarayıcıda çalışan, yüklenebilir (PWA) ve çevrimdışı kullanılabilen bir sunum hazırlama uygulaması.

Sunum oluşturun ya da **PowerPoint (.pptx)** dosyanızı açın, düzenleyin, tam ekran sunun ve **.present** dosyası olarak indirin.

## Özellikler

- **Dosyalar:** Birden çok sunum; hepsi cihazınızda (IndexedDB) otomatik kaydedilir.
- **Açma:** `.present` ve `.pptx` dosyaları (düğmeyle ya da ana sayfaya sürükleyip bırakarak).
- **Düzenleyici:** Metin, dikdörtgen, elips ve görsel öğeleri; sürükle, boyutlandır, hizalama kılavuzları.
- **Biçimlendirme:** Yazı tipi, boyut, renk, kalın / italik / altı çizili, hizalama, dolgu, kenarlık, köşe yuvarlama.
- **Temalar ve düzenler:** 6 tema, 5 slayt düzeni, slayt arka planı, konuşmacı notları.
- **Sunum modu:** Tam ekran; ok tuşları, boşluk, tıklama veya kaydırma ile gezinme.
- **İndirme:** Sunumlar `.present` dosyası olarak indirilir. İstenirse aynı dosya `.pptx` uzantısıyla da indirilebilir. 🖨 düğmesiyle yazdırılabilir veya PDF olarak kaydedilebilir.

## .present dosya biçimi — PowerPoint uyumlu

`.present` dosyası, içeride **geçerli bir PowerPoint (.pptx / Office Open XML) paketidir**:

- Slaytlar, metinler, şekiller, görseller, arka planlar ve konuşmacı notları standart PowerPoint öğeleri olarak yazılır. Dosya PowerPoint, Keynote, Google Slaytlar ve LibreOffice ile açılır. Uzantıyı `.pptx` yapmak ya da indirirken “PowerPoint (.pptx)” seçeneğini kullanmak yeterlidir; LibreOffice `.present` uzantısıyla da doğrudan açar.
- Paketin içinde ayrıca `present/deck.json` bulunur. Present bu dosyayı okuyarak sunumu **kayıpsız** geri yükler. PowerPoint bu parçayı yok sayar.
- PowerPoint'te düzenlenip kaydedilen dosyalar Present'e normal `.pptx` olarak aktarılır.
- Eski sürümlerin ürettiği JSON tabanlı `.present` dosyaları da açılmaya devam eder.
- **PWA:** Ana ekrana / masaüstüne yüklenebilir, internet olmadan çalışır.

## Çalıştırma

Herhangi bir statik sunucu yeterlidir (service worker için `file://` yerine `http://` gerekir):

```bash
npm start            # veya: python3 -m http.server 8080
```

Ardından <http://localhost:8080> adresini açın. GitHub Pages, Netlify vb. bir yere doğrudan yüklenebilir; derleme adımı yoktur.

## PowerPoint uyumluluğu

### PowerPoint → Present (açma)

- **Metin:** Kelime düzeyinde biçim (kalın, italik, altı çizili, üstü çizili, renk, boyut, yazı tipi, büyük harf), paragraf hizalaması, madde işaretleri (Wingdings dahil) ve numaralandırma, girinti seviyeleri, satır ve paragraf aralıkları, iç boşluklar, dikey hizalama, PowerPoint'in kaydettiği otomatik sığdırma oranı.
- **Şekiller:** 100'e yakın hazır şekil (oklar, yıldızlar, akış şeması, pasta/yay, bulut, parantez…), serbest çizimler (custGeom), bağlayıcı çizgiler ve ok uçları, kesikli çizgiler, döndürme ve yansıtma.
- **Dolgular:** Düz renk, saydamlık, doğrusal ve radyal geçişler, resim/doku dolgusu (döşemeli dahil), tema stilleri (fillRef/lnRef), tema renkleri ve renk değiştiricileri (tint, shade, lumMod, satMod…).
- **Görseller:** Kırpma, yuvarlak/elips çerçeve, kenarlık.
- **Tablolar:** Gerçek tablo olarak; birleştirilmiş hücreler, hücre dolguları, tablo stilleri (başlık satırı, bantlı satırlar…), kenarlıklar.
- **SmartArt:** PowerPoint'in kaydettiği çizimden şekil ve metin olarak.
- **Diğer:** Gruplar, ana slayt ve düzen öğeleri, yer tutucu kalıtımı, arka planlar (renk, geçiş, resim), slayt boyutu (16:9, 4:3…), konuşmacı notları.
- **Aktarılmayanlar:** Grafikler (yerine bilgi kutusu konur), video/ses, animasyon ve geçişler, gölge/parlama efektleri, EMF/WMF görseller.

### Present → PowerPoint (indirme)

Slayt içeriği PowerPoint'in beklediği yapıda (Office Open XML) doğrudan yazılır: metin kutuları kelime düzeyinde biçimiyle, hazır şekiller ve serbest çizimler kendi geometrisiyle, tablolar gerçek PowerPoint tablosu olarak, geçişler ve doku dolguları PowerPoint dolgusu olarak kaydedilir. Böylece dosya PowerPoint'te "onarım" uyarısı vermeden açılır ve düzenlenebilir kalır.

## Klavye kısayolları

| Kısayol | İşlem |
| --- | --- |
| Çift tıklama / Enter | Metni veya tablo hücresini düzenle |
| Shift+Enter (düzenlerken) | Paragraf içinde satır sonu |
| Ctrl+B / Ctrl+I / Ctrl+U (düzenlerken) | Seçili kelimeleri biçimlendir |
| Ctrl+Z / Ctrl+Y | Geri al / Yinele |
| Ctrl+C / Ctrl+X / Ctrl+V | Kopyala / Kes / Yapıştır |
| Ctrl+D | Çoğalt |
| Delete | Seçili öğeyi sil |
| Ok tuşları (Shift ile 10px) | Öğeyi kaydır |
| Ctrl+B / Ctrl+I / Ctrl+U | Kalın / İtalik / Altı çizili |
| Alt + sürükleme | Kılavuza yapışmadan taşı |
| Shift + köşe tutamacı | Oranı koruyarak boyutlandır |
| F5 / Shift+F5 | Baştan sun / Geçerli slayttan sun |
| Ctrl+S | Kaydet |

## Dosya yapısı

```
index.html            Uygulama arayüzü
styles.css            Stiller
app.js                Uygulama mantığı
shapes.js             PowerPoint hazır şekillerinin geometrisi
pptx-import.js        PowerPoint (.pptx) içe aktarma
pptx-export.js        PowerPoint (.pptx / .present) yazma
sw.js                 Service worker (çevrimdışı önbellek)
manifest.webmanifest  PWA bildirimi
icons/                Uygulama ikonları
vendor/               PptxGenJS 3.12.0 (MIT, JSZip içerir) — paket iskeleti ve ZIP
```

## Sürüm güncelleme

Yeni sürüm çıkarırken `app.js` içindeki `APP_VERSION`, `sw.js` içindeki `VERSION` (ve dosyalar her değiştiğinde `BUILD`), `manifest.webmanifest` ve `package.json` sürümlerini birlikte güncelleyin. Service worker önbellek adı sürüme bağlıdır; eski önbellek otomatik silinir.

## Lisans

MIT. [PptxGenJS](https://github.com/gitbrent/PptxGenJS) (MIT) ve içerdiği [JSZip](https://github.com/Stuk/jszip) (MIT) kullanılır; lisansları `vendor/` klasöründedir.
