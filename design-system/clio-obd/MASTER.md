# Clio OBD — Tasarım sistemi (MASTER)

Arayüzün tek doğruluk kaynağı. Sayfaya özel bir sapma gerekirse `pages/<sayfa>.md` açılır ve bu dosyadaki kuralları yalnızca o sayfa için geçersiz kılar.

## Ürün

- **Tür:** Araç teşhis aracı, gerçek zamanlı telemetri paneli (mobil web, PWA)
- **Kullanım bağlamı:** Araç içinde, Samsung Galaxy M12 (360×800 CSS px), Chrome; gece ve güneş altında, sürüş sırasında hızlı bakış
- **Ayarlar:** Variance 4 (dengeli), Motion 3 (sade), Density 8 (yoğun panel)

## Stil

- **Ana stil:** Dark Mode (OLED). Neredeyse siyah zemin, yüksek kontrast, parlama yok.
- **Açık tema:** Destekleniyor (Automotive paleti), cihaz ayarına göre otomatik.
- **Bulanıklık:** Yalnızca alt menüde. Üst çubukta kullanılmaz, çünkü `backdrop-filter` içindeki sabit konumlu alt menünün konum referansını bozar. Kartlarda da yok.
- **Gölge:** Kartlar düz ve kenarlıklı. Gölge yalnızca uyarı bandı ve bildirim gibi yüzen öğelerde.
- **İkonlar:** Tek aile, 24×24 görünüm kutusu, 2 px çizgi, yuvarlak uç (Lucide çizgisi). Emoji kullanılmaz.

## Renkler

| Rol | Koyu | Açık | Not |
|---|---|---|---|
| Zemin | `#020617` | `#F8FAFC` | OLED dostu |
| Kart | `#0F172A` | `#FFFFFF` | |
| Kart içi yüzey | `#1B2336` | `#F1F5F9` | kutucuklar, satırlar |
| Ayırıcı | `#273449` | `#E2E8F0` | |
| Belirgin kenarlık | `#475569` | `#CBD5E1` | girişler, ikincil düğmeler |
| Metin | `#F8FAFC` | `#0F172A` | |
| İkincil metin | `#94A3B8` | `#475569` | koyu zeminde 6,9:1 |
| Vurgu / ana eylem | `#22C55E` | `#22C55E` | üstündeki metin `#0F172A` (9:1) |
| Vurgu (yazı, ince çizgi) | `#22C55E` | `#15803D` | seçili sekme, seçili kutu, grafik çizgisi; açık temada 5:1 |
| Tamam | `#22C55E` | `#15803D` | |
| Dikkat | `#F59E0B` | `#B45309` | |
| Sorun | `#EF4444` | `#DC2626` | |

Durum rengi tek başına anlam taşımaz; her zaman yazı (Tamam / Dikkat / Sorun) veya ikonla birlikte kullanılır.

## Tipografi

- **Etiket ve metin:** Fira Sans 400 / 500 / 600 / 700
- **Sayısal değerler:** Fira Sans 600, `font-variant-numeric: tabular-nums` (rakamlar sabit genişlikte, değer değişirken titremez)
- **Kimlik metinleri:** Fira Code 500 / 600; yalnızca arıza kodu, şasi no, CALID/CVN, ham bayt ve terminal. Sayısal değerlerde kullanılmaz, çünkü eşit genişlikli yazıda Türkçe binlik nokta ve ondalık virgül tam rakam genişliği kaplar ve "2 . 349" gibi aralıklı görünür.
- **Ölçek:** 12 · 13 · 14 · 16 · 18 · 22 · 28 · 64 px. Gövde metni 16 px; 12 px yalnızca birim ve ikincil etiketlerde.

## Boşluk, köşe, hareket

- **Boşluk (yoğun):** 4 · 8 · 12 · 16 · 24 · 32 px
- **Köşe:** 8 (küçük) · 12 (öğe) · 16 (kart) · tam (hap)
- **Süre:** 150 ms renk ve opaklık · 200 ms dönüşüm · çıkış girişin yaklaşık %70'i
- **Basma geri bildirimi:** `transform: scale(.97)`, düzen kayması yok
- `prefers-reduced-motion` açıksa animasyonlar kapanır.

## Bileşen kuralları

- **Dokunma hedefi:** Tüm düğmeler en az 44 px yüksek. Küçük düğme 40 px.
- **Ana eylem:** Her ekranda tek ana eylem (vurgu rengi). Silme gibi tehlikeli eylemler kırmızı kenarlıklı, ayrı yerde ve onay ister.
- **Odak:** 2 px halka, 2 px boşluk, vurgu renginde. Kaldırılmaz.
- **Alt menü:** 5 sekme, ikon ve yazı birlikte, etkin sekme renk ve zeminle belirtilir. İçerik menünün altında kalmaz.
- **Gerçek zamanlı veri:** Canlı etiketi yalnızca veri gerçekten akarken gösterilir, yanında son güncelleme süresi bulunur. 3 sn'den uzun süre veri gelmezse "Veri eski" uyarısı çıkar ve değerler soluklaşır.
- **Akan grafik:** Alan grafik, son 300 ölçüm; yanında anlık değer, en düşük, en yüksek ve ortalama yazılır; duraklatma düğmesi vardır.
- **Bildirim:** 3 ila 5 sn içinde kendiliğinden kapanır, odağı çalmaz. Kritik uyarılar kullanıcı kapatana kadar kalır.
- **Boş durum:** Ne yapılacağını adım adım söyler ve bir eylem sunar.

## Kaçınılacaklar

- Ham hex değeri bileşen içinde (yalnızca token)
- Durumu yalnızca renkle anlatmak
- 44 px'ten küçük dokunma hedefi
- Kartlarda bulanıklık veya parlama efekti
- Hareketin anlamsız kullanımı, aynı anda birden çok animasyon
