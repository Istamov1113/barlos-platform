# BARLOS: saytni ishga tushirish qo'llanmasi

Bu qo'llanma dasturlash bilmaydigan odam uchun yozilgan. Ikki qism bor:

- **A qism**: o'z kompyuteringizda sinab ko'rish (30 daqiqa, bepul).
- **B qism**: internetga chiqarish, ya'ni mijozlar kira oladigan haqiqiy sayt (taxminan 1–2 soat, oyiga ~5–10 USD server).

Avval A qismni bajaring. Hammasi ishlashiga ishonch hosil qilgach, B ga o'ting.

---

## Sayt nimalarni qila oladi

- **Kirish**: faqat email + parol. Mijoz o'zi "Hisob ochish" orqali ro'yxatdan o'tadi va avtomatik bo'sh "Universal hisob" oladi.
- **Admin**: `eldoristamov381@gmail.com` emaili bilan kirgan odam. Boshqa hech kim admin bo'la olmaydi. Admin boshqalarni "Operator" qilishi mumkin.
- **Sayt bo'sh**: aktiv, mijoz, bitim yo'q. Hammasini o'zingiz qo'shasiz.
- **Aktiv qo'shish**: qo'lda yoki Bitget / CoinMarketCap / Finviz / uzse.uz dan qidirib import qilish. Narxlar avtomatik yangilanib turadi.
- **Hisobotlar**: filtr, saralash, qidiruv va Excel (.xlsx) yuklab olish.
- **Avto savdo**: chartdagi alert yoki qo‘lda signal → har bir mijoz uchun alohida hisob → bitta umumiy order → mijozlarga taqsimot.
- **Hech narsa o'chirilmaydi**: tranzaksiya faqat sabab bilan "Bekor qilingan" deb belgilanadi, aktiv faqat arxivlanadi.

> **Muhim haqiqat.** "Bozorga yuborish" tugmasi bitimni **hisobga yozadi** (mijozlar hisobiga taqsimlaydi). U Bitget yoki IBKR da haqiqiy order **joylashtirmaydi**. Haqiqiy savdoni birjada o'zingiz (yoki operator) bajarasiz, so'ng shu yerda bajarilgan narxni kiritib tasdiqlaysiz. Birjaga avtomatik ulanish alohida, keyingi bosqich (API kalitlari, xavfsizlik va test talab qiladi).

> **Narx import qilish haqida halol eslatma.** Bitget, CoinMarketCap, Finviz, uzse.uz dan narx olish kodi yozilgan, lekin men uni o'z muhitimda jonli sinay olmadim (u yerdan bu saytlarga chiqish yopiq). Shuning uchun sizning serveringizda birinchi marta "Aktivlar → Manbalarni tekshirish" tugmasini bosing: har bir manba uchun yashil/qizil natija ko'rasiz. Qizil bo'lsa, xato matnini menga yuboring, tuzataman. Narxni har doim qo'lda ham kiritish mumkin.

---

## Yangi versiyani o'rnatish: ma'lumotlaringiz yo'qolmaydi (MUHIM)

Hamma ma'lumot (mijozlar, aktivlar, bitimlar, jurnal, chart sozlamalari) **`data/barlos.db`** faylida turadi. Men bergan zip ichida `data` papkasi va `.env` fayli **yo'q**: shuning uchun yangilashda ular o'chmaydi. Faqat quyidagicha qiling:

1. Serverni to'xtating (terminalda `Ctrl+C`).
2. **Zaxira oling** (ixtiyoriy, lekin tavsiya): admin sifatida *Sozlamalar → Zaxira nusxani yuklab olish*, yoki terminalda `npm run backup`.
3. Yangi zip ni **eski `barlos` papkasi ustiga** oching ("fayllarni almashtirish" ni tanlang). Papkani o'chirmang va yangi nom bilan ochmang.
4. Terminalda `cd barlos`, so'ng `npm install` (kutubxonalar o'zgarmagan bo'lsa ham zarar qilmaydi), so'ng `npm start`.

Agar yangi zip ni **boshqa papkaga** ochgan bo'lsangiz: eski papkadagi `data` papkasini (va bo'lsa `.env` faylini) yangi papka ichiga ko'chiring. Bazani qayta tiklash ham shunday: zaxira `.db` faylini `data/barlos.db` nomi bilan qo'yasiz (server to'xtagan bo'lsin).

**Eng ishonchli yo'l:** `.env` fayliga `DATA_DIR=/yo'l/barlos-data` (Windows: `DATA_DIR=C:/barlos-data`) qatorini yozing. Shunda ma'lumotlar kod papkasidan tashqarida turadi va qaysi papkaga ochishingizdan qat'i nazar saqlanadi.

Server o'zi ham har 6 soatda `data/backups` papkasiga zaxira nusxa saqlab boradi (oxirgi 30 ta). Yangi versiya eski ma'lumotlarni o'zi tanib oladi, hech narsani qo'lda ko'chirish shart emas.

---

## 2.2.1: chartdagi "104799.99" xatosi tuzatildi

**Sabab:** chartdagi "⬆ Tarix" tugmasi bilan bir necha fayl tanlanganda, hammasi ochiq turgan aktivga yozilgan (fayl nomidagi ISIN e'tiborga olinmagan). Natijada obligatsiya (ACMT2B4 va b.) narxlari ~104 800 aksiya chartiga aralashib, EMA/BB buzilgan. 104799.99 haqiqiy obligatsiya narxi.

**Endi:** aktivni avval fayl nomidagi ISIN/tiker aniqlaydi; narxlari mavjud tarixdan 5 barobardan ko'p farq qilsa, fayl yuklanmaydi.

**Tuzatish (ma'lumot yo'qolmaydi, avtomatik zaxira olinadi):**
1. 2.2.1 ni o'rnating (data/ va .env ga tegmang), serverni qayta ishga tushiring.
2. Aktivlar → Tarixiy ma'lumotlar → "Barcha tarixni tozalash".
3. Barcha uzse.uz fayllarini (nomida ISIN bor) bitta bo'lib shu bo'limdagi "Yuklash" orqali qayta yuklang. Har bir aktivning "Manba kodi"da ISIN bo'lishi shart.

## 2.11.0: Hisobotlar+Hujjatlar birlashdi, aktiv oynasi, omonat signali, profil, chat

**Yangilash:** `data/` va `.env` ga tegmang. `npm install`, so'ng serverni qayta ishga tushiring.

1. **Hisobotlar va Hujjatlar bitta sahifa.** Hujjatlar avtomatik (tizim) va qo'lda (admin) yaratiladi. Mijoz o'z hisobida hisobotlarni faqat ko'radi va yuklab oladi; yaratish faqat admin uchun.
2. **Aktiv oynasi.** Bosh, Aktivlar yoki Portfelda aktivni bosing: miqdor, emitent, ISIN, o'rtacha narx, joriy qiymat, ulush, daromad, koeffitsient, jami daromad (so'm va %), pastda Binance uslubidagi tranzaksiyalar. Omonat uchun to'liq avtomatik, tahrirsiz oyna.
   - Koeffitsient farazi: BUY/DEPOZIT/TRANSFER-kirim = kiritilgan pul; SELL/WITHDRAW/KUPON/TRANSFER-chiqim = qaytgan pul. Shu pul oqimi yillik 25% kunlik hisob bilan solishtiriladi (joriy kurs bilan).
3. **Omonat foizi signali faqat Avto savdoda** (Bosh/Aktivlarda yo'q): umumiy tranzaksiya va mijozlar ulushlari. Guruh bo'yicha tasdiqlash mumkin.
4. **Profil:** rasm yuklash, o'zgarmas tizim ID, ixtiyoriy username, tavsif, maxfiylik (kim yozishi, qidiruvda ko'rinish).
5. **Chat:** shaxsiy, guruh, kanal va muhokama guruhi. Xabarlar SHA-256 zanjiri va HMAC imzo bilan saqlanadi, tahrirlash/o'chirish aniqlanadi.
   - Diqqat: bu xesh buzilishni aniqlaydi, **shifrlash emas**. Admin/bazaga kirish huquqi borlar xabarlarni o'qiy oladi.

**Halollik:** hammasi namunaviy ma'lumotda sinalgan (287 test); tashqi manbalar bilan jonli ishlash o'zingizning kompyuteringizda tekshiriladi.

## 2.10.0: Stoch RSI maqsadlari, shartnoma bandlari, avtomatik PDF hisobotlar

**Yangilash:** `data/` va `.env` ga tegmang. Yangi paket kerak: serverda `npm install` ni ishga tushiring (PDF uchun `pdfkit`), so'ng serverni qayta ishga tushiring.

**1. Joriy maqsad (yangi formula).** Eski guruh koeffitsientlari (0.7285, 1.006 va boshqalar) olib tashlandi: ular kodda qo'lda yozilgan sonlar edi.
- Turlar (Kripto, Xalqaro, Milliy, Metall): `d = F − (F/3) · SIGN(s) · |s|^1.316`, `s = (M − 50) / 50`. F: turning normal ulushi (yig'indi 100 ga keltiriladi), M: asosiy aktivning 1 haftalik Stoch RSI (K chiziq).
- Foizli guruhlar (Omonat, Obligatsiya, Naqd): `(100 − foizsiz d yig'indisi) × guruh normali ÷ foizli normallar yig'indisi`.
- Aktiv: `guruh d × aktivning normali ÷ guruhning normali`. Joriy maqsadlar yig'indisi doim 100%.
- Stoch RSI: RSI 14 (Wilder), Stoch 14, K = 7, D = 3, TradingView usulida; K qiymati olinadi. Asosiy aktivlar: BTC, SPY (SPYB...), UZNF, XAUT. Sozlamalar → "Asosiy aktivlar va 1W Stoch RSI" da tanlanadi va parametrlar o'zgartiriladi. Qiymat soatiga bir marta serverda saqlangan haftalik tarixdan hisoblanadi (kamida 34 ta haftalik sham kerak). Yetarli tarix bo'lmasa M = 50 (d = F) olinadi va jadvalda "—" ko'rinadi.
- Maqsadli ulushlar va Portfel jadvallari pastida **Jami** qatori: ustunlar yig'indisi (100% bo'lsa ✓, bo'lmasa farq ko'rsatiladi).

**2. Shartnoma bandlari.** Shartnoma matni (14 bo'lim, 4 ilova) tizimga kiritilgan. Sozlamalar → "Shartnoma bandlari (admin)" da qaysi bandlar mijozga ko'rsatilishi belgilanadi va matn tahrirlanadi. Boshlang'ich belgilanganlar: 2.2, 5.1, 5.3, 6.4, 6.5, 6.7, 8.3, 10.2, 10.3, 11.2, 11.3.
- Yangi mijoz ro'yxatdan o'tganda bandlarni ko'radi va rozilik belgilamasa hisob ochilmaydi.
- Avval ro'yxatdan o'tganlar tizimga kirganda tasdiqlash oynasini ko'radi; tasdiqlamaguncha yozuv o'zgartiradigan amallar to'xtatiladi.
- Tasdiqlash yozuvlari (kim, qachon, versiya, IP, qurilma) o'chirilmaydi. Ko'rsatiladigan bandlar o'zgarsa versiya oshadi va hamma qayta tasdiqlaydi.
- Matndagi `[___]` bo'sh joylarni (muddatlar, 8.3-banddagi variant) ishga tushirishdan oldin to'ldiring; yurist ko'rigidan o'tkazing.

**3. Avtomatik PDF hisobotlar** (xlsx shakllari asosida). Hujjatlar sahifasi: mijoz o'z PDF larini, admin hammasini ko'radi.
- Mijoz hisobiga: oylik (F3 + F4 + F9), chorak (F3 + F4 + F5 + F9 + F7), yillik (F3 + F5 + F7 + choraklar).
- Admin hisobiga: NAPPga (F1 o'rtacha yillik qiymat, F2 o'z mablag'lari testi, F8 muvofiqlik) va soliqqa (F6 shartnoma kesimida, QQS holati, mijoz daromadlari jamlanmasi, kalendar). Mijoz bularni ko'rmaydi.
- Davr tugagach (oy, chorak, yil) soatlik tsikl hujjatlarni o'zi tayyorlaydi; mijozga bildirishnoma tushadi. Hozir tayyorlash: Hujjatlar → "Hozir tayyorlash". Qayta tayyorlash yangi versiya qo'shadi, eskisi o'chmaydi.
- Qiymatlar tranzaksiyalar jurnalidan va saqlangan tarixiy narxlardan olinadi. Tarixiy narx topilmasa joriy narx ishlatiladi va hujjatda ogohlantirish chiqadi. Dollar kursi hozirgi kurs bo'yicha.
- Omonat foizi soliqqa tortilmaydi (F7 da "soliq solinmaydi").
- **Siz to'ldirishingiz kerak:** Sozlamalar → "Hisobot sozlamalari": kompaniya rekvizitlari, o'z mablag'lari tarkibi, haq va soliq stavkalari, QQS holati, F8 qo'lda belgilanadigan bandlar. Stavkalar hozircha namuna (boshqaruv haqi 0%, muvaffaqiyat haqi 10%, foyda solig'i 15%, dividend 5%, QQS 12%). Soliq stavkalari ikkilamchi manbadan olingan, buxgalter bilan tasdiqlang. Hujjatlar NAPP ning rasmiy shakli emas, ichki shakllar.

---

## 2.9.0: omonat foizi: oyiga bir marta to'lov, signal va tasdiqlash

**Qoidalar (siz aytganingizdek):**
- To'lov oyiga **bir marta**. Aktivni tahrirlashda "Omonat boshlanish sanasi" kiritiladi (kiritilmasa omonatga birinchi kirim sanasi olinadi). Bank har oy shu kunning **ertasi** to'laydi. Masalan boshlanish 15-sana bo'lsa, to'lov 16-sanada, foiz 15-sanagacha hisoblangan bo'ladi. Oyda shu kun bo'lmasa (31, 30, 29) oyning oxirgi kuni olinadi.
- Foiz omonat kelgan kundan keyingi kundan, har kuni `S × R / 365`; yechilgan kun uchun foiz yo'q; qisman yechilsa qolgan qoldiqdan (o'zgarmadi).
- **Yaxlitlash**: doimo verguldan keyin 8 xonagacha, ortiqcha nollar ko'rsatilmaydi (8,12000000 → 8,12). Hisoblash ham 8 xonada yaxlitlanib bajariladi.
- **Soliq hisoblanmaydi** (omonatlarga soliq yo'q).
- Foiz omonatga **faqat to'lov tasdiqlangandan keyin** qo'shiladi. To'lovgacha u "hisoblangan, to'lanmagan" bo'lib turadi (portfel qiymatida "shu jumladan foiz" sifatida ko'rinadi).
- **Signal**: to'lov kuniga 3 kun qolganda (va to'lov kuni, o'tib ketgan bo'lsa ham) Bosh sahifaning tepasida "Omonat foizi to'lovi" signali chiqadi. Bank foizni o'tkazgach **Tasdiqlash** tugmasini bosasiz. Shunda foiz FOIZ tranzaksiyasi bo'lib yoziladi va omonat qoldig'iga qo'shiladi. Signal admin jurnaliga ham tushadi, email sozlangan bo'lsa adminlarga xat ham boradi.
- To'lovlar sana tartibida tasdiqlanadi (oldingisini tasdiqlamay keyingisini yozib bo'lmaydi). Bir to'lov ikki marta yozilmaydi.
- To'lov davriyligi endi faqat ikkita: "Har oy bir marta" yoki "To'lov signali kerak emas". Chorak/yillik olib tashlandi.

**Siz qilishingiz kerak:** Aktivlar → omonat aktivi → Tahrirlash: "Yillik foiz", "Omonat boshlanish sanasi" va "Har oy bir marta" ni belgilang. Shundan keyin signal avtomatik chiqadi. Hozirgi ma'lumot o'zgarmaydi (yangilashda `data/` va `.env` ga tegmang).

---

## 2.8.0: omonat foizi BARLOSda, portfel koeffitsienti kunlik hisob, yangi dizayn

**Omonat foizi.** Omonat guruhidagi aktivga "Yillik foiz" (masalan 22) va (ixtiyoriy) "Omonat foizi to'lov davriyligi" qo'yiladi (Aktivlar → Tahrirlash).
- Foiz mablag' omonatga kirgan kundan keyingi kundan hisoblanadi, chiqarilgan/yechilgan kun uchun hisoblanmaydi, har kuni `S × R / 365`, qisman yechilsa qolgan haqiqiy qoldiqdan.
- Qoldiq tranzaksiyalardan olinadi (kirim: Depozit, Xarid, o'tkazma kirimi; chiqim: Yechish, Sotish, o'tkazma chiqimi; FOIZ yozuvi qoldiqqa qo'shiladi).
- Hisoblangan, hali to'lanmagan foiz portfel qiymatiga (va ulush/statuslarga) qo'shiladi; portfel jadvalida "shu jumladan foiz" ko'rinadi.
- Aktivlar sahifasidagi **Omonat foizi** kartasida: har hisob bo'yicha hisoblangan, to'langan, to'lanmagan foiz va to'lov sanalari. Bank foizni to'lagach "Foizni yozish" tugmasi FOIZ yozuvini (to'lov davriyligi `qoldiqqa qo'shiladi` bo'lsa) yoki Kupon yozuvini (naqd to'lansa) kiritadi. Sanalar omonat ochilgan kundan boshlab hisoblanadi (oyda shu kun bo'lmasa oyning oxirgi kuni). Oldingi sanadagi foiz yozilmaguncha keyingisini yozib bo'lmaydi. Eslatmalar admin jurnaliga tushadi.

**Portfel koeffitsienti.** Endi kiritilgan va yechilgan pullar yillik taqqoslash stavkasi (Sozlamalarda, standart 25%) bilan xuddi omonatdagidek kunlik hisoblanadi (kirgan kundan keyingi kundan, yechilgan kunsiz). Koeffitsient = joriy qiymat / shu qiymat. Sozlamalarda foizni "oddiy" yoki har oy/chorak/yil qo'shiladigan qilish mumkin (standart: oddiy foiz). Oldingi "yillik murakkab 25%" hisobi o'zgardi, shu sababli eski hisobotlardagi koeffitsientlar bir oz boshqacha chiqishi mumkin.

**Dizayn.** Qora va tillarang, shaffof (shisha) yuzalar. Jadvallar va ro'yxatlar Jett uslubida: aktiv katagida logotip, nomi va "SIMVOL | TURI"; xarid yashil, sotish qizil chiziq; holatlar yumaloq belgi. "Sozlamalar → Tizim ko'rinishi" da yorug' ko'rinish ham bor (iliq oq fon, tillarang urg'u).

---

## 2.7.0: obligatsiya kuponi, yig'ilgan foiz va YTM signali; omonat foizi yadrosi

- **Omonat foizi (yadro):** `Core.accrue()`. Foiz tushgan kundan keyingi kundan, qaytarilgan kunsiz, har kuni `S × R / 365`, qisman yechishda haqiqiy qoldiqdan. Hozircha interfeysga ulanmagan (savollar tasdig'ini kutmoqda).
- **Obligatsiya:** obligatsiya guruhidagi aktivga `bond` (nominal, yillik kupon %, davriylik, birinchi kupon sanasi yoki aniq sanalar, so'ndirish sanasi, ixtiyoriy: so'ndirish %, narx yig'ilgan kupon bilanmi, signal yoqilganmi, maqsadli daromad) saqlanadi. API: `POST /api/assets` (maydon `bond`).
- `GET /api/bonds` (admin/operator): kupon jadvali, yig'ilgan kupon foizi, YTM, signal, kutilayotgan va yozilmagan kuponlar. `POST /api/bonds/accept {key}`: kupon (KUPON yozuvi, dona × kupon) yoki so'ndirish (nominal bo'yicha SELL) ni yozadi; bir kupon ikki marta yozilmaydi.
- **Kunlik tsikl** (soatiga bir marta tekshiriladi): kupon 3 kun oldin, kuni va yozilmagan bo'lsa admin jurnaliga eslatma tushadi; aktivda `bond.sig` yoqilgan bo'lsa, YTM maqsadli daromaddan (standart 25%) 1 punkt yuqori bo'lsa BUY, 3 punkt past bo'lsa SELL signali kuniga bir marta Avto savdoga yuboriladi. Sozlamalar: `bondHurdle`, `bondBuy`, `bondSell`.
- Hisoblar: kupon (1 dona) = nominal × stavka / davriylik; yig'ilgan foiz = kupon × (oxirgi kupondan o'tgan kun / davr kunlari); YTM actual/365 bo'yicha yillik samarali daromad. Qisman amortizatsiya hali qo'llab-quvvatlanmaydi.

---

## 2.6.0: Binance asosiy manba (data-api.binance.vision), yangilash jadvali

**Nima o'zgardi**

- Kripto, metall va tokenlashgan aksiyalar narxi hamda tarixi endi avval **Binance**dan (`https://data-api.binance.vision`, zaxirada `api.binance.com`) olinadi. Kalit kerak emas.
- Binancedan topilmagan juftliklar (masalan, tokenlashgan aksiyalar `NVDAON`) avtomatik **Bitget**dan olinadi. Ikkalasida ham bo'lmasa, OKX (faqat narx) zaxira bo'ladi. Aktivlarni qo'shish formasidagi manba turi nomi o'sha-o'zi (`Bitget`) qoladi: hech narsani qayta kiritish shart emas.
- **Narx va oxirgi kunlik shamlar har 5 daqiqada** yangilanadi: barcha Binance narxlari bitta umumiy so'rov bilan olinadi, shamlar esa har aktiv uchun bitta kichik so'rov (oxirgi 5 kun) bilan. To'liq tarix faqat aktiv qo'shilganda bir marta olinadi (Binance startTime bo'yicha sahifalab).
- **Excel/havola tarixi har 2 soatda** yangilanadi: uzse.uz va "Tarix havolasi" bor aktivlarning havolasi har 2 soatda faqat oxirgi sanadan boshlab so'raladi, ya'ni faqat yangi kunlar qo'shiladi. Eski kunlar o'chmaydi. Havolasiz, faqat qo'lda Excel yuklangan aktivlarda yangilanadigan manba yo'q, ular qo'lda yuklash bilan to'ldiriladi.
- Xatoda: 429 bo'lsa 1 soat kutiladi; Binance/Bitget xatosida 10 daqiqadan keyin, havola tarixi xatosida keyingi 2 soatlik navbatda qayta uriniladi. Binancedan topilmagan juftlikka 6 soat qayta so'rov yuborilmaydi.
- "Narxlarni avto yangilash" intervali o'rnatilgach 5 daqiqaga tushirildi (Sozlamalarda o'zgartirishingiz mumkin).
- Diskka yozish kamaydi: sham ma'lumoti o'zgarmagan bo'lsa fayl qayta yozilmaydi.

**Sozlash.** Hech narsa shart emas. Xohlasangiz `.env` da: `CRYPTO_SYNC_MIN=5` (Binance daqiqalari), `HIST_HOURS=2` (havola tarixi soatlari), `BINANCE_HOSTS=https://data-api.binance.vision,https://api.binance.com`. O'zgartirgach serverni qayta ishga tushiring.

**Tekshirish.** Aktivlar → Manbalar → ↻ bosing: yuqorida "Binance (BTCUSDT) · data-api.binance.vision" qatori yashil bo'lishi kerak. Aktivlar jadvalida narx manbasi ko'rinadi (zaxira ishlatilsa "Bitget" yoki "zaxira manba (OKX)").

**Halol eslatma.** Sandbox'dan Binance'ga chiqib bo'lmaydi, shuning uchun jonli tekshiruvni siz qilasiz (siz ochgan havola brauzeringizda ishlagan, BARLOS esa shu kompyuterdan o'sha manzilga boradi, demak ishlashi kerak). Avtomatik testlar soxta serverlar bilan o'tgan: narx, sham, topilmagan juftlik zaxirasi, 400 xotirasi, 5 daqiqa va 2 soat jadvali. Google o'tkazgichi (2.5.0) endi shart emas, Binance to'g'ridan-to'g'ri ochilsa uni sozlamang; ochilmay qolsa, o'tkazgich `data-api.binance.vision` ni ham o'tkazadi (skriptni yangilab, **New version** qilib joylang).

---

## 2.5.0: Google Apps Script o'tkazgichi (Bitget internet provayderingizda ochilmasa)

**Nima uchun kerak.** Diagnostikangiz ko'rsatdi: provayder DNS (UDP/53) va Bitget IP manzillariga to'g'ridan-to'g'ri TCP ulanishni to'sadi, lekin Google serverlari Bitgetga bemalol chiqadi. O'tkazgich shu yo'ldan foydalanadi: BARLOS so'rovni Googlega yuboradi, Google Bitgetdan javobni olib BARLOSga qaytaradi. Bepul, serverga muhtoj emas.

**Sxema:** BARLOS (kompyuteringiz) → `script.google.com` → Bitget / Binance / Yahoo / Stooq / CoinGecko → javob teskari yo'ldan qaytadi.

### Sozlash (taxminan 10 daqiqa, bir marta)

1. Brauzerda https://script.google.com oching, Google hisobingiz bilan kiring.
2. **New project** (Yangi loyiha) tugmasini bosing.
3. Chapdagi `Code.gs` ichidagi hamma matnni o'chiring va loyiha ichidagi `docs/google-apps-script-relay.gs` faylining butun matnini joylang.
4. Eng yuqoridagi qatorni toping: `var KEY = 'BU_YERGA_UZUN_MAXFIY_SOZ_YOZING';`. Qo'shtirnoq ichiga o'zingiz o'ylab topgan **uzun maxfiy so'z** (kamida 24 harf va raqam, masalan tasodifiy tanlangan) yozing. Bu so'zni eslab qoling, 7-qadamda kerak bo'ladi. Ctrl+S bilan saqlang.
5. O'ng yuqorida **Deploy → New deployment** bosing. Chap tomondagi tishli g'ildirak (Select type) → **Web app** tanlang.
   - **Execute as:** `Me` (sizning hisobingiz)
   - **Who has access:** `Anyone` (hamma)
   Keyin **Deploy** bosing. Google ruxsat so'raydi: **Authorize access** → hisobingizni tanlang → "Advanced / Qo'shimcha" → "Go to ... (unsafe)" → **Allow**. Bu o'zingiz yozgan skript, xavfsiz.
6. Chiqqan **Web app URL** ni nusxalang. U `https://script.google.com/macros/s/.../exec` bilan tugaydi.
7. BARLOS papkasidagi `.env` faylini oching (yo'q bo'lsa `.env.example` dan nusxa oling) va ikki qator yozing:

```
RELAY_URL=https://script.google.com/macros/s/XXXXXXXX/exec
RELAY_KEY=4-qadamda_yozgan_maxfiy_so'zingiz
```

8. BARLOSni to'xtatib qayta ishga tushiring.
9. Saytda **Aktivlar → Manbalar** kartasidagi ↻ tugmasini bosing. Bitget qatorida **"o'tkazgich (Google) orqali"** yozuvi va yashil belgi chiqsa, tayyor.

*Brauzerda tekshirish (ixtiyoriy):* `RELAY_URL?key=MAXFIY_SOZ&url=https%3A%2F%2Fapi.bitget.com%2Fapi%2Fv2%2Fspot%2Fmarket%2Ftickers%3Fsymbol%3DBTCUSDT` manzilini oching. `{"code":"00000",...}` ko'rinsa, o'tkazgich ishlayapti.

### Qaysi so'rovlar o'tkazgichdan o'tadi

- **O'tadi:** `api.bitget.com`, `api.binance.com`, Yahoo Finance (`query1/query2`), `stooq.com`, `api.coingecko.com`. Narxlar va sham tarixi shular orqali olinadi.
- **O'tmaydi:** `uzse.uz` (u sizda allaqachon ishlayapti) va BARLOS ichki so'rovlari.
- **Shaxsiy Bitget API kalitingiz o'tkazgichga yuborilmaydi.** Narx va sham ma'lumotlari Bitgetda ochiq, kalit kerak emas. O'tkazgich yoqilganda ochiq so'rovlar ishlatiladi, kalit esa faqat o'tkazgich ishlamay qolib BARLOS to'g'ridan-to'g'ri urinib ko'rgandagina imzo uchun ishlatiladi (u ham provayder to'ssa o'tmaydi).
- O'tkazgich ishlamasa (internet yo'q, Google javob bermasa) BARLOS avtomatik to'g'ridan-to'g'ri yo'lga qaytadi va 3 daqiqa o'tkazgichni qayta urinmaydi. Kalit noto'g'ri yoki Bitget 429 bergan bo'lsa, xato aniq ko'rsatiladi.

### Cheklovlar (halol eslatma)

- Google bepul hisobda kuniga taxminan 20 000 ta tashqi so'rov (UrlFetch) ruxsat beradi. BARLOS so'rovlarni cheklab yuboradi (tarix faqat bir marta olinadi, keyin kuniga bir marta), shuning uchun odatdagi foydalanishda yetarli.
- Har so'rov 1–3 soniya ko'proq vaqt oladi (Google orqali o'tadi). Narx yangilash biroz sekinroq bo'lishi tabiiy; chartlar esa mahalliy tarixdan ochiladi, ularga ta'sir qilmaydi.
- Skriptni keyinroq o'zgartirsangiz: **Deploy → Manage deployments → qalam belgisi → Version: New version → Deploy**. Shunda URL o'zgarmaydi. Oddiy saqlash (Ctrl+S) joylangan versiyani yangilamaydi.
- Maxfiy so'z (`KEY`) va URL ni hech kimga bermang va ochiq joyga (chat, ekran rasmi) qo'ymang. Kimdir ikkalasini bilsa, sizning Google kvotangizdan foydalanishi mumkin (faqat yuqoridagi ro'yxatdagi saytlarga).
- Bu yo'l sandbox'da jonli sinalmagan (u yerdan Google va Bitgetga chiqib bo'lmaydi). Soxta serverli avtomatik testlar o'tgan (marshrutlash, kalit xatosi, 429, HTML javob, zaxira yo'l), lekin birinchi haqiqiy tekshiruvni siz 9-qadamda qilasiz.

### Xatolar va ma'nosi

| Ko'rinadigan xabar | Sabab | Yechim |
|---|---|---|
| `O'tkazgich: kalit (RELAY_KEY) noto'g'ri` | `.env` dagi kalit skriptdagi `KEY` bilan bir xil emas, yoki skriptda KEY hali o'zgartirilmagan | Ikkalasini bir xil qiling, skriptni **New version** qilib qayta joylang |
| `O'tkazgich HTML qaytardi ... "Who has access: Anyone"` | Deploy da "Anyone" tanlanmagan yoki Google kirish sahifasi qaytyapti | Deploy sozlamasini tuzating, 5-qadamni takrorlang |
| `O'tkazgich HTTP 404 / 401` | `RELAY_URL` xato yoki eski joylash | `/exec` bilan tugaydigan oxirgi URL ni qo'ying |
| `O'tkazgich: ... ulanib bo'lmadi` | `script.google.com` ham ochilmayapti | Brauzerda shu sahifa ochilishini tekshiring; ochilmasa Oracle Cloud yo'liga o'ting |
| `HTTP 429 (api.bitget.com · o'tkazgich orqali)` | Bitget so'rov ko'p deb to'xtatdi | BARLOS o'zi kutadi (Retry-After), qo'lda qayta-qayta bosmang |
| `RELAYERR 400 ruxsat etilmagan manzil` | Skriptdagi `ALLOW` ro'yxatida host yo'q | Skript yangi versiyasini joylang (faylni qayta nusxalang) |

O'tkazgichni o'chirish uchun `.env` dan `RELAY_URL` va `RELAY_KEY` qatorlarini olib tashlab, BARLOSni qayta ishga tushiring.

---

## 2.4.1: Bitget shaxsiy API kaliti

`.env` fayliga qo'shing (kalit faqat "Read-only" ruxsat bilan bo'lsin; Trade va Withdraw yoqmang):

```
BITGET_API_KEY=...
BITGET_API_SECRET=...
BITGET_API_PASSPHRASE=...
```

Serverni qayta ishga tushiring. Shundan so'ng Bitgetga barcha so'rovlar imzolanib (ACCESS-KEY, ACCESS-SIGN, ACCESS-TIMESTAMP, ACCESS-PASSPHRASE) yuboriladi; "Narx manbalari holati" da Bitget qatori "shaxsiy API kalit" deb ko'rinadi. Kalit faqat server ichida ishlatiladi, brauzerga yuborilmaydi. Eslatma: narx va sham ma'lumotlari Bitgetda ochiq (public), shuning uchun kalit mintaqa/IP cheklovini yoki 429 ni o'zi olib tashlamaydi; u so'rovlarni hisobingiz nomidan imzolaydi.

---

## 2.4.0: tezlik, tarixga qayta-qayta so'rov yo'q, Aktivlar sahifasi yangilandi

**Tarix qoidasi (siz so'ragandek).** Tarixiy narxlar tashqi saytdan:
1. aktiv qo'shilganda **bir marta** to'liq olinadi (Bitget/Yahoo: API orqali; uzse.uz: havola shabloni orqali, agar sozlangan bo'lsa);
2. keyin **kuniga bir marta** yangi kunlar qo'shiladi (uzse.uz uchun 16:30 dan keyin; boshqalar uchun 20 soatda bir marta);
3. xato bo'lsa 6 soatdan oldin (429 bo'lsa 1 soatdan oldin) qayta urinilmaydi;
4. olinmasa, qatordagi **Excel yuklash** bilan o'zingiz yuklaysiz. Sanasi bir xil kunlar yangilanadi, yangilari qo'shiladi, eskisi o'chmaydi.
Kun ichidagi narx o'zgarishi bugungi shamga server narxni yangilab turgan sayin yozib boriladi (tashqi so'rovsiz).

**Chart tezligi.** Kunlik/haftalik/oylik chart endi faqat serverning o'z bazasidan chiqadi: aktivdan aktivga o'tish soniyaning bir qismida (tekshiruvda 0,3 s). Tashqi saytga faqat 1m–4h chartlar uchun murojaat bo'ladi va oxirgi javob saqlanadi.

**Narxlarni yangilash / manbalarni tekshirish tezligi.**
- Manbalar tekshiruvi: har manbaga bitta so'rov, hammasi bir vaqtda, 10 soniyadan oshmaydi (avval 121 soniya edi).
- Narx yangilashda har manba turi parallel ishlaydi (uzse.uz sekinligi Bitgetni to'xtatmaydi).
- Ochilmayotgan sayt 3 daqiqaga o'tkazib yuboriladi (har safar kutib o'tirmaydi).
- Ishlamaydigan zaxira manzillar (api.bitgetapi.com, binance.vision, binance.us) olib tashlandi.
- Narx snapshotlari hajmi qisqartirildi (saqlash yengillashdi).

**Aktivlar sahifasi.**
- Yuqorida "Narx manbalari holati": o'ng tepada ↻ belgisi bilan qayta tekshiriladi (oxirgi natija saqlanadi).
- "Aktivlar katalogi": o'ng tepada **+ Aktiv** va **↻** (narxlarni yangilash).
- Ustunlar: Aktiv, Guruh, Narx (pastida yangilanish vaqti), Manba (pastida kodi), Normal %, Kunlar (pastida dan–gacha), Havola (pastida qisqa log; ↻ bilan shu aktiv tarixini hozir olish), amallar: Tahrirlash, Arxiv, Excel yuklash, CSV, Tozalash.
- Qatordagi "Excel yuklash" faqat shu aktivga yozadi; fayl nomidagi ISIN boshqa aktivniki bo'lsa yoki narxlar shkalasi mos kelmasa yuklanmaydi (aralashib ketishdan himoya).
- Havola shabloni va ko'p fayl yuklash "Tarix sozlamalari" blokida (katalog ostida).

**Halol eslatma.** Bitget/uzse.uz/Yahoo'ga mening muhitimdan chiqib bo'lmaydi, shuning uchun ularning jonli ishlashi sinalmagan; interfeys, tezlik va saqlash mantig'i sinalgan (118 avtomatik test + brauzer tekshiruvi).

---

## 2.3.0: tarmoq xatolari, to'liq tarix, TradingView olib tashlandi, chart sozlamalari

**1. "Bitget fetch failed".** Bu Bitget sizning kompyuteringizdan umuman ochilmayotganini bildiradi (internet, DNS, VPN yoki provayder cheklovi), kod xatosi emas. Endi:
- Xatoda sababi aniq yoziladi (masalan `ENOTFOUND`, `ETIMEDOUT`).
- Bitget ikkita manzildan, so'ng Binance va OKX dan (oddiy kripto juftliklar uchun) zaxira sifatida so'raladi. Tokenlashgan aksiyalar (MSFT, NVDA...) faqat Bitgetda bor, shuning uchun ular uchun Bitget ochilishi shart.
- Agar Bitget faqat VPN/proksi orqali ochilsa: `npm i undici`, so'ng ishga tushirishdan oldin `BARLOS_PROXY=http://manzil:port` (yoki `HTTPS_PROXY`) o'rnating. Tekshirish: brauzerda `https://api.bitget.com/api/v2/spot/market/tickers` ochilishi kerak.

**2. uzse.uz "HTTP 429".** Sayt juda ko'p so'rovdan himoyalanadi. Endi so'rovlar orasida 2,2 soniya kutiladi, 429 kelsa sayt aytgan muddat kutib qayta uriniladi, tarix kuniga bir marta olinadi, 429 dan keyin 1 soat tinch turiladi. "Fayldan birorta sham o'qilmadi" xatosida endi javob turi, hajmi va boshidagi matn ko'rsatiladi (odatda bu Excel o'rniga xato/cheklov sahifasi kelganini bildiradi). Shu xabarni menga yuborsangiz, havolani to'g'rilab beraman.

**3. Havoladagi STK va BND.** Shablonni bitta qilib yozing, tizim aktiv turiga qarab o'zi almashtiradi: obligatsiya guruhi → `BND`, qolganlari → `STK`. Xohlasangiz `{type}` deb ham yozish mumkin. Eslatma: obligatsiya aktivi "Obligatsiya" guruhida bo'lsin.

**4. Barcha aktivlar uchun to'liq tarix va oflayn rejim.**
- Aktiv qo'shilganda (yoki manbasi o'zgarganda) tarix avtomatik yuklanadi: Bitget aktivlari API orqali (sahifalab, yillar bo'yicha), AQSh aksiyalari Yahoo/Stooq orqali, uzse.uz aktivlari havola shabloni orqali (yoki Excel).
- Keyin har 30 daqiqada yangilanadi va `hc` bazasiga yozib boriladi. Aktivlar → Tarixiy ma'lumotlar jadvalida har aktiv uchun holat ko'rinadi (havola/API, oxirgi yangilanish, xato).
- Internet yoki manba ishlamasa: chart serverda saqlangan oxirgi ma'lumotdan chiqadi ("Oflayn rejim" ogohlantirishi bilan), aktivning narxi oxirgi ma'lum qiymatda qoladi. Narx hech qachon olinmagan bo'lsa, oxirgi sham yopilish narxi ko'rsatiladi ("tarixdan").
- Kunlik tarix hech qachon o'chirilmaydi (faqat sanasi bir xil sham yangilanadi).

**5. TradingView olib tashlandi.** Webhook manzili, maxfiy kalit va "TradingView tikeri" maydoni yo'q. Signal faqat chart alertlari (🔔) va qo'lda yuborish orqali keladi. Eski signallar jurnalda qoladi.

**6. Chart sozlamalari (⚙ yuqori qatorda), TradingView "Settings" kabi:**
- *Symbol:* chart turi (shamlar, bo'sh shamlar, Heikin Ashi, chiziq, maydon), tana/chegara/soya ranglari, narx aniqligi, vaqt zonasi.
- *Status line:* nom, OHLC, o'zgarish, seans vaqti, indikator nomlari va qiymatlari.
- *Scales and lines:* shkala turi (oddiy/log/foiz/100 ga keltirilgan), avto-masshtab, teskari shkala, oxirgi narx yorlig'i va chizig'i, oldingi yopilish chizig'i, hisoblagich, chekkalar, to'r, kursor rejimi va uslubi.
- *Canvas:* mavzu, fon, matn, to'r va kursor ranglari, fon yozuvi.

**7. Chizmalar sozlamalari.** Chizma tanlanganda yuqorida panel chiqadi: rang, qalinlik, uslub, sozlamalar (⚙ yoki chizmani ikki marta bosish), qulflash, yashirish, nusxa, o'chirish; gorizontal chiziqda 🔔 (shu narxda alert). Oynada *Style / Coordinates / Visibility*: davom ettirish (chapga/o'ngga), narx o'zgarishi, to'ldirish va shaffoflik, Fibonachchi darajalarini tahrirlash/qo'shish, matn o'lchami va fon, nuqtalarning aniq narx/vaqti, qaysi vaqt oraliqlarida ko'rinishi. Ctrl+Z / Ctrl+Y (yoki chap paneldagi ↶ ↷) bilan bekor qilish/qaytarish. Hammasi har bir foydalanuvchi uchun saqlanadi.

**O'zim topgan kamchiliklar (hali yo'q, keyingi bosqich uchun):** yana chizma turlari (kanal, strelka, qalam, o'lchagich, Andrews vilkasi), boshqa aktiv bilan solishtirish, replay (tarixni qayta o'ynash), bir nechta chart yonma-yon, sozlamalar shablonlari, indikatorni boshqa indikatorga qo'llash, hajm profili, intraday uzse.uz (u saytda kunlik ma'lumot bor).

---

## Yangiliklar (2.2-versiya): uzse.uz tarixi, superchart, alertlar

**1. uzse.uz tarixiy ma'lumotlari (UZNF va boshqa 20 ta aktiv).**
- *Aktivlar → Tarixiy ma'lumotlar*: uzse.uz dan yuklab olgan Excel/CSV fayllaringizni (bir nechtasini birdan) tanlab "Yuklash" ni bosing. Aktiv fayl nomidagi **ISIN** bo'yicha topiladi (`conclusions_UZ7058980010_….xlsx` → UZNF). Buning uchun aktivning "Manba kodi" maydonida ISIN (`UZ7058980010`) yozilgan bo'lishi kerak. Chartdagi "⬆ Tarix" tugmasi ham joriy aktiv uchun shuni qiladi.
- Fayldan Sana, Yopilish narxi, Ochilish, Yuqori, Quyi, Savdo hajmi o'qiladi (sizning faylingizdagi 120 kun muvaffaqiyatli o'qildi). Bir xil sanalar yangilanadi, yangilari qo'shiladi, eskilari o'chmaydi: shuning uchun har kuni/haftada yangi faylni yuklab borsangiz kifoya.
- **Uzluksizlik:** server narxni yangilab turgan sayin bugungi kunlik shamni o'zi to'ldirib boradi (rasmiy fayl yuklangach u aniq qiymat bilan almashadi). Dam olish kunlari sham yaratilmaydi. 21 ta aktiv uchun xotira muammo emas (bir aktivga yillar uchun bir necha yuz KB).
- **To'liq avtomatik yangilash:** uzse.uz saytida aktiv sahifasidagi Excel yuklash tugmasi ustida o'ng tugma → "Havolani nusxalash". Havolani *Tarixiy ma'lumotlar* bo'limidagi shablon maydoniga qo'ying, ISIN o'rniga `{isin}`, sanalar o'rniga `{from}` va `{to}` (kun.oy.yil) yozing. Server har 30 daqiqada yangilaydi. Havola cheklangan bo'lsa (kirish talab qilsa), xatosi jadvalda ko'rinadi, u holda fayl yuklashda davom eting.
- Google Sheets/Excel: ixtiyoriy aktivning CSV ini jadvaldan ("CSV" tugmasi) yuklab olish yoki o'zingiz tayyorlagan `Date, Open, High, Low, Close, Volume` ustunli CSV ni yuklash mumkin.

> Halol eslatma: uzse.uz ning yuklab olish havolasini men ko'ra olmadim (sayt mening muhitimdan yopiq), shuning uchun avtomatik yangilashni havolani o'zingiz kiritadigan qilib yaratdim. Fayldan yuklash esa sizning haqiqiy faylingizda sinab ko'rildi.

**2. Seans yopilishigacha hisoblagich.** Narx belgisi ostida sham yopilishigacha qolgan vaqt ko'rinadi (TradingView kabi). Qoidalar (Toshkent vaqti): uzse.uz aktivlari **16:00** (ish kunlari), Bitget kripto va tokenlashgan aksiyalar **05:00** (00:00 UTC, har kuni), Finviz/AQSh aksiyalari 16:00 Nyu-York. Boshqa vaqt kerak bo'lsa, aktivda "Seans yopilishi" maydoniga `HH:MM` (ish kunlari) yoki `HH:MM all` (har kuni) yozing, masalan `17:00`. Hafta va oy shamlari uchun ham shu qoida bo'yicha hisoblanadi.

**3. Indikatorlar: superchart darajasida.** Indikator qatorida (chap tepada) tugmalar: ⚙ sozlamalar, 👁 yashirish, `</>` manba kodi, ✕ o'chirish. Sozlamalar oynasida:
- **Inputs:** uzunlik, ko'paytirgich, manba (Close/Open/High/Low/HL2/HLC3/OHLC4) va h.k.
- **Style:** har bir chiziq uchun ko'rinish, rang, qalinlik, uzluksiz/shtrix/nuqta.
- **Visibility:** qaysi vaqt oraliqlarida (1m…M) ko'rinsin.
- **Source code:** Pine Script ekvivalenti (BB AlgoAlpha uchun sizning to'liq kodingiz). Admin uchun **Custom (JS)** indikatori bor: o'zingiz kod yozib chartga chiqarasiz (shablon tayyor). U faqat chartda ishlaydi, alertda ishlatilmaydi.

**4. Alertlar (🔔 Alert tugmasi).** Server har daqiqada tekshiradi, shuning uchun brauzer yopiq bo'lsa ham ishlaydi.
- Shart: *A* (narx, RSI, EMA, SMA, MACD, Stoch RSI, Bollinger, BB AlgoAlpha, qiymat) + amal (kesib o'tdi ↑/↓, >, <, signal sodir bo'ldi) + *B*. Vaqt oralig'i istalgan (1m…M). Tayyor shablonlar bor.
- **BB (AlgoAlpha copy) signali:** "BUY signali"/"SELL signali" shabloni + "AUTO" tanlansa, signal **Avto savdo → Signallar** bo'limiga keladi va odatdagidek order hosil qiladi (siz tasdiqlab "Bozorga yuborish" ni bosasiz; o'zi bitim qilmaydi).
- Tekshirish: "sham yopilganda" (tavsiya, soxta signal kam) yoki "joriy shamda". Har shamda bir marta ishlaydi. Ishga tushganda saytda xabar chiqadi, Jurnalga yoziladi, ixtiyoriy emailga ham ketadi (SMTP sozlangan bo'lsa).
- Mijozlar ham alert yarata oladi, lekin ular faqat xabar oladi; Avto savdoga signal faqat admin alertlaridan boradi.

> Halol eslatma: alertlar uchun server shamlarni aktivning manbasidan oladi (Bitget/Yahoo/uzse tarixi). Intraday (1m–4h) alert uzse.uz aktivlarida ishlamaydi, chunki uzse faqat kunlik ma'lumot beradi; ular uchun kunlik (D) alert qo'ying. Jonli manbalarni sinay olmaganim sababli, birinchi alertni kichik sinovdan o'tkazing.

---

## Yangiliklar (2.1-versiya)

**Portfel.** Mijozning Portfel bo'limida endi faqat hisobida haqiqatan mavjud aktivlar (va ularning guruh/turlari) ko'rinadi.

**Ichki o'tkazmada komissiya.** Mablag'lar → Ichki o'tkazma: *Komissiya %* va/yoki *Qat'iy komissiya* (jami, hisoblar ulushiga qarab bo'linadi) kiriting. Ikki usul: **"Summa ichidan ushlanadi"** (masalan 2 000 000 so'mdan komissiya ayrilib, qolgani USDT ga aylanadi) yoki **"Hisobdan qo'shimcha yechiladi"**. "Hisoblash"da har bir hisob uchun komissiya va olinadigan miqdor jadvalda ko'rinadi.

**Chart (TradingView uslubida).** Chap menyuda "Chart".
- Aktivni yuqoridan tanlang (faqat admin qo'shgan aktivlar). Vaqt oralig'i: 1m, 5m, 15m, 1h, 4h, D, W, M.
- Shamlar aktivning narx manbasidan olinadi: Bitget aktivlari Bitgetdan; Finviz aktivlari Yahoo Finance (zaxirada Stooq) dan; uzse.uz, veb-sahifa va qo'lda kiritilgan aktivlar uchun serverning o'zi har narx yangilanishida yozib borgan **narx tarixidan** (shuning uchun ular chartida dastlab shamlar kam bo'ladi va vaqt o'tgan sayin to'lib boradi). Aktiv sozlamasida "Chart manbasi" maydoni bor: masalan `bitget:BTCUSDT`, `yahoo:GC=F` (oltin), `stooq:aapl.us`.
- **Indikatorlar** ("ƒx Indikatorlar"): EMA, SMA, Bollinger Bands, RSI, MACD, Stoch RSI, Hajm. Bir nechtasini qo'shsa bo'ladi, parametrlari (uzunlik, rang) o'zgartiriladi. Chart ustidagi indikator qatorida ⚙ sozlash, 👁 yashirish, ✕ o'chirish.
- **Admin uchun "BB (AlgoAlpha copy)":** siz bergan Pine kodidagi mantiq bo'yicha: 2σ–3σ zonalar (qizil/sariq), 4 ta EMA (14, 20 trend rangida va to'ldirilgan, 50, 200), BUY (sariq ↑) va SELL (qizil ↓) belgilari. Admin birinchi kirganda u o'zi yoqilgan bo'ladi. Boshqa foydalanuvchilarda bu indikator yo'q.
- **Chizish asboblari** (chapda): trend chizig'i, nur, gorizontal va vertikal chiziq, to'rtburchak, Fibonachchi, matn. Chizma ustiga bosib tanlang, sudrab ko'chiring, `Delete` yoki 🗑 bilan o'chiring. 🧲 magnit shamning O/H/L/C qiymatiga yopishtiradi. Pastdagi ranglar yangi (yoki tanlangan) chizma rangini o'zgartiradi.
- **Saqlanadi:** har bir foydalanuvchining indikatorlari, vaqt oralig'i va mavzusi, hamda har bir aktiv bo'yicha chizmalari uning akkauntida saqlanadi: boshqa sahifaga o'tsangiz, qayta kirsangiz yoki boshqa qurilmadan kirsangiz ham joyida turadi.
- Yuqori o'ngda: mavzu (qora/oq), rasmga olish, to'liq ekran.

> Halol eslatma: chartni men o'z muhitimda sintetik ma'lumot bilan sinadim (indikatorlar, chizish, saqlash ishladi). Bitget/Yahoo dan **jonli** shamlar olishni sinay olmadim (u saytlarga bu yerdan chiqib bo'lmaydi). Birinchi ishga tushirganda Chart sahifasida "Manba: …" yozuvini ko'ring. Agar xato chiqsa, matnini menga yuboring.

---

## Yangiliklar (2-versiya): nimalar o'zgardi

**1. Tahrirlash faqat adminda.** Tranzaksiyani faqat admin tahrirlay oladi (Tranzaksiyalar → qator → "Tahrirlash"). Har bir o'zgarish tarixi saqlanadi va Jurnalga tushadi. Mijoz faqat **amalga oshirilgan** tranzaksiyalarni ko'radi: bekor qilingan (o'chirilgan) va tahrir tarixi unga ko'rinmaydi.

**2. Hisob-kitob valyutasi (USD/USDT).** Endi bitim qaysi valyutada o'tsa, pul o'sha aktivdan ayriladi/qo'shiladi:
- Bitget savdolari (BTC/USDT, QQQon/USDT) → **USDT** naqd aktividan;
- boshqa dollar aktivlari (IBKR) → **USD** naqd aktividan;
- so'mdagi aktivlar (uzse.uz) → **UZS**.
Aktiv kartasida "Hisob-kitob aktivi" maydoni bor: kerak bo'lsa qo'lda tanlang. Bitim kiritishda ham alohida tanlash mumkin.
**Shart:** Aktivlar bo'limida "USDT" (va kerak bo'lsa "USD") **naqd** aktivi bo'lishi kerak. Uni "+ Naqd" orqali qo'shing, so'ng pulni pastdagi "Ichki o'tkazma" bilan o'tkazing.

**3. Ichki o'tkazma (Mablag'lar → Ichki o'tkazma).** Masalan UZS (Naqd) → USDT (Bitget):
1. Qaysi aktivdan, qaysi aktivga, summa va (kerak bo'lsa) dollar kursini kiriting.
2. Kerakli hisoblarni belgilang ("Hammasini belgilash" bilan hammasi).
3. "Hisoblash (ko'rish)": har bir hisobdan qancha ayrilishi va qancha qo'shilishi jadvalda chiqadi. Summa hisoblar **ulushiga (mavjud qoldiqqa) proporsional** bo'linadi.
4. "Tasdiqlash va bajarish" bosilgandan so'ng hamma hisobga bir vaqtda yoziladi.

**4. Depozit (mijoz).** Mijoz Mablag'lar sahifasida summa va to'lov usulini tanlaydi → rekvizit, to'lov kodi (BRL-XXXXXX) va **QR kod** chiqadi → "To'lov qildim" → admin tekshirib "Tasdiqlash" bosadi → faqat shundan keyin hisobda ko'rinadi.
To'lov usullarini **Sozlamalar** bo'limidagi to'lov usullari qismida kiriting (karta raqami, qabul qiluvchi, ixtiyoriy to'lov havolasi: Click/Payme havolasi bo'lsa QR shu havolani ochadi).
> Halol eslatma: Click/Payme orqali *to'liq avtomatik* tasdiqlash uchun ularning merchant shartnomasi va API kaliti kerak. Hozircha tasdiqlashni admin qo'lda qiladi (xavfsizroq ham).

**5. Jurnal (admin).** Barcha harakatlar: vaqt, IP manzil, qurilma, brauzer, foydalanuvchi nomi/emaili/roli, harakat va tafsilot. Jurnal o'chirilmaydi, filtr (qidiruv, foydalanuvchi, sana) va Excel yuklash bor.

**6. uzse.uz va "Veb-sahifa" manbasi.** uzse.uz parseri qayta yozildi: tikerni (UZNF) yoki ISIN ni yozing yoki havolani (`https://uzse.uz/isu_infos/STK?isu_cd=UZ7058980010`) qo'ying. Agar baribir narx topilmasa, **"Veb-sahifa (selektor)"** manbasi bor, Google Sheets'dagi IMPORTXML ga o'xshash: maydonga `havola || selektor` yozing. Selektorni olish: sahifada narx ustida o'ng tugma → Inspect → element ustida o'ng tugma → Copy → Copy selector. Qolgan maydonlarni qo'lda to'ldirasiz.

**Eski bitimlarni tuzatish.** Oldin kiritilgan QQQon/BTC bitimlari so'mdan ayrilgan yoki "naqdga ta'sir qilmasin" belgisi bilan kiritilgan bo'lishi mumkin. Tuzatish: (a) USDT naqd aktivini qo'shing; (b) Ichki o'tkazma bilan USDT kiriting; (c) bitimni admin sifatida "Tahrirlash" → belgini olib tashlab, hisob-kitob aktivini tanlang.

---

# A qism. O'z kompyuteringizda sinash

## 1-qadam. Node.js o'rnating

1. https://nodejs.org saytiga kiring.
2. **LTS** emas, **22 yoki undan yangi** versiyani yuklang (kamida 22.5 kerak). Yuklangan faylni oching va hamma savolga "Next" / "Keyingi" deb o'rnating.
3. Tekshirish: Windows'da **Start → "cmd"** yozib Command Prompt oching (Mac'da **Terminal**). Yozing:
   ```
   node -v
   ```
   `v22.…` yoki yuqori raqam chiqsa, tayyor.

## 2-qadam. Loyihani oching

1. Men bergan `barlos.zip` faylini kompyuteringizda **Hujjatlar (Documents)** papkasiga ochib oling. Natijada `barlos` papkasi hosil bo'ladi.
2. Command Prompt (Terminal) da shu papkaga o'ting:
   - Windows: `cd %USERPROFILE%\Documents\barlos`
   - Mac: `cd ~/Documents/barlos`

## 3-qadam. Kutubxonalarni o'rnating (bir marta)

```
npm install
```
1–2 daqiqa davom etadi. Oxirida xato (`ERR!`) bo'lmasligi kerak.

## 4-qadam. Sozlama faylini yarating (ixtiyoriy)

Hozircha shart emas. Kerak bo'lganda: `.env.example` faylidan nusxa olib nomini `.env` qiling va ichini to'ldiring (CoinMarketCap kaliti, email va h.k.). Admin emaili allaqachon `eldoristamov381@gmail.com` qilib qo'yilgan.

## 5-qadam. Admin parolini o'rnating

```
npm run setup
```
Dastur parol so'raydi (kamida 8 belgi, yozayotganda yulduzcha chiqadi), keyin takrorlashni so'raydi. Bu parol bilan `eldoristamov381@gmail.com` sifatida admin bo'lib kirasiz. Parolni unutsangiz, shu buyruqni qayta bajaring: yangi parol o'rnatiladi.

> Nega ro'yxatdan o'tish orqali emas? Agar admin emailini oddiy "Hisob ochish" orqali ochishga ruxsat bersak, begona odam sizdan oldin shu emailni band qilib olishi mumkin. Shuning uchun admin faqat serverning o'zida yaratiladi.

## 6-qadam. Saytni ishga tushiring

```
npm start
```
"BARLOS ishga tushdi: http://localhost:3000" yozuvi chiqadi. **Bu oynani yopmang**, sayt shu oyna ochiq turguncha ishlaydi. To'xtatish: oynada `Ctrl + C`.

Brauzerda oching: **http://localhost:3000**

## 7-qadam. Sinab ko'ring (tavsiya etilgan tartib)

**Admin sifatida:**
1. `eldoristamov381@gmail.com` + 5-qadamdagi parol bilan kiring.
2. **Sozlamalar** → "Dollar kursi": kursni kiriting (masalan 12000) yoki "CBU dan avtomatik" belgisini yoqing (internet bo'lsa) → Saqlash.
3. **Aktivlar**:
   - "+ Naqd so'm (UZS)" tugmasini bosing (depozitlar shu aktiv orqali kiritiladi).
   - "+ Aktiv qo'shish": yuqoridagi qidiruvda manbani tanlang (Bitget / CoinMarketCap / Finviz / uzse.uz), tikerni yozing (BTC, AAPL, UZ… ISIN), "Qidirish" → natijadan "Tanlash" → **Normal ulush %** kiriting → Saqlash. Yoki hamma maydonni qo'lda to'ldiring.
4. **Mijoz hisobini oching**: boshqa brauzerda (yoki Inkognito oynada) http://localhost:3000 ga kirib "Hisob ochish" orqali test mijoz yarating.
5. Admin oynasida **Bosh sahifa** → mijozni bosing → **Bitim kiritish**:
   - Tur: DEPOZIT, aktiv: UZS, miqdor: 10000000 → Qo'shish.
   - Tur: BUY, aktiv: BTC, miqdor: 0.01 → Qo'shish.
6. Mijoz oynasida portfel, diagramma va tranzaksiyalarni ko'ring (bir necha soniyada o'zi yangilanadi).
7. **Hisobotlar** → "Tranzaksiyalar" → "Excel (.xlsx) yuklab olish".
8. **Avto savdo** → "Qo'lda signal" (BTC, SELL) → "Orderlar" bo'limida order paydo bo'ladi → qatorni bosib mijozlar bo'yicha Ruxsat/Rad ni ko'ring → "Bozorga yuborish".
9. **Profil → Foydalanuvchilar va qurilmalar**: barcha foydalanuvchilar, ularning kirgan qurilmalari.

Ma'lumotlar `barlos/data/barlos.db` faylida saqlanadi. Sinovdan so'ng toza boshlamoqchi bo'lsangiz: serverni to'xtatib, `data` papkasini o'chiring va 5-qadamdan boshlang.

## Tez-tez uchraydigan muammolar (A qism)

| Muammo | Yechim |
|---|---|
| `node` buyrug'i topilmadi | Node.js o'rnatilmagan yoki o'rnatgandan keyin Command Prompt'ni yopib qayta oching. |
| `node:sqlite` xatosi | Node versiyasi eski. 22.5 yoki yangisini o'rnating. |
| `EADDRINUSE` (port band) | `.env` da `PORT=3001` deb o'zgartiring va saytni http://localhost:3001 dan oching. |
| "Bu email administrator uchun ajratilgan" | To'g'ri. Adminni "Hisob ochish" orqali emas, 5-qadam (`npm run setup`) bilan yarating. |
| Aktiv import "fetch failed" | Kompyuteringiz o'sha saytga chiqa olmayapti yoki sayt bloklayapti. "Manbalarni tekshirish" ni bosing, qo'lda narx kiriting. |

---

# B qism. Internetga chiqarish

Mijozlar kirishi uchun sayt doimiy yoqilgan kompyuterda (server) turishi kerak.

## 1-qadam. Domen va server

1. **Domen** oling (masalan `barlos.uz`): uz domenlarni .UZ registratorlari yoki istalgan xalqaro registrator (Namecheap, GoDaddy…) beradi.
2. **Server (VPS)** oling: Hetzner, DigitalOcean, Vultr yoki shu kabilar. Kerak: **Ubuntu 24.04**, 1 CPU, 1–2 GB RAM (eng arzon reja yetadi). Server yaratilgach sizga **IP manzil** va parol/SSH kalit beriladi.
3. Domen sozlamalarida (DNS) **A yozuvi** qo'shing: `@` (yoki `barlos.uz`) → server IP manzili. 5–30 daqiqada kuchga kiradi.

## 2-qadam. Serverga kiring va Docker o'rnating

Kompyuteringizdagi Command Prompt / Terminal'dan (IP ni o'zingiznikiga almashtiring):
```
ssh root@SERVER_IP
```
Serverda:
```
curl -fsSL https://get.docker.com | sh
```
Docker o'rnatiladi (1–2 daqiqa).

## 3-qadam. Loyihani serverga yuklang

Kompyuteringizda (serverdan chiqib, yangi oynada) `barlos` papkasi turgan joyda:
```
scp -r barlos root@SERVER_IP:/root/
```
(`node_modules` papkasini yuborish shart emas: bo'lsa o'chirib yuboring, u sekinlashtiradi.)

## 4-qadam. Sozlamalarni kiriting

Serverda:
```
cd /root/barlos
cp .env.example .env
nano .env
```
To'ldiring:
- `DOMAIN=barlos.uz` (o'z domeningiz)
- `ADMIN_EMAIL=eldoristamov381@gmail.com`
- `CMC_API_KEY=` CoinMarketCap kaliti (ixtiyoriy)
- `SMTP_…` email sozlamalari (ixtiyoriy, pastga qarang)

Saqlash: `Ctrl+O`, Enter, `Ctrl+X`.

## 5-qadam. Ishga tushiring

```
docker compose up -d --build
```
Birinchi marta 3–5 daqiqa oladi. Caddy domeningiz uchun **HTTPS sertifikatni o'zi oladi**. Keyin admin parolini o'rnating:
```
docker compose exec app npm run setup
```
Brauzerda **https://barlos.uz** ni oching. Tayyor.

## Kundalik buyruqlar (serverda, `cd /root/barlos` ichida)

| Maqsad | Buyruq |
|---|---|
| Jurnalni ko'rish | `docker compose logs -f app` |
| Qayta ishga tushirish | `docker compose restart app` |
| Yangi versiyaga o'tkazish (fayllarni yangilab) | `docker compose up -d --build` |
| Admin parolini tiklash | `docker compose exec app npm run setup` |
| To'xtatish | `docker compose down` (ma'lumotlar saqlanib qoladi) |

## Zaxira nusxa (backup): majburiy

Barcha ma'lumot bitta bazada. Har kuni nusxa oling:
```
docker run --rm -v barlos_barlos-data:/data -v /root:/backup alpine tar czf /backup/barlos-backup-$(date +%F).tgz /data
```
Hosil bo'lgan `.tgz` faylni boshqa joyga (kompyuteringiz, Google Drive) ko'chirib qo'ying. Buni avtomatlash uchun `crontab -e` ga har kuni 03:00 da shu buyruqni qo'shishingiz mumkin.

## Email (ixtiyoriy): tasdiqlash kodi va parol tiklash

`.env` da `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` ni to'ldiring. Gmail uchun: `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=sizning@gmail.com`, `SMTP_PASS=` Google hisobingizdagi **"App password"** (oddiy parol emas; 2 bosqichli himoya yoqilgan bo'lishi kerak). Shundan keyin:
- ro'yxatdan o'tganda mijoz emailiga 6 xonali kod keladi va tasdiqlamaguncha kira olmaydi;
- "Parolni unutdim" ishlaydi.

SMTP bo'lmasa: mijoz darhol kira oladi (email tasdiqlanmaydi) va parolni unutsa, admin **Profil → Foydalanuvchilar** orqali vaqtinchalik parol o'rnatadi.

> Email yuborish yoqilsa, adminni `npm run setup` bilan yaratish shart emas: `eldoristamov381@gmail.com` bilan "Hisob ochish" orqali kod bilan tasdiqlab ham admin bo'la olasiz. Lekin `setup` ishonchliroq.

## Xavfsizlik ro'yxati

- Admin paroli uzun va noyob bo'lsin (12+ belgi).
- `.env` faylini hech kimga yubormang va hech qayerga yuklamang.
- Siz yuborgan "Mening olamim" jadvalida **ochiq matnda tokenlar va Google xizmat hisobi kalitlari** bor edi. Ularni fayldan olib tashlang va kalitlarni (Telegram bot tokeni, Google service account) **yangisiga almashtiring**: ular allaqachon boshqalarga ko'ringan bo'lishi mumkin.
- Serverni muntazam yangilang: `apt update && apt upgrade -y`.
- Zaxira nusxani olishni unutmang.

## Eslatma: bepul hostinglar (Render, Railway, Vercel)

Bu dastur ma'lumotni fayl ko'rinishidagi bazada saqlaydi. Bepul rejalarda disk doimiy emas: server qayta ishga tushganda barcha mijoz va tranzaksiyalar **yo'qoladi**. Shuning uchun yuqoridagi VPS usulini tavsiya qilaman. Boshqa platformani tanlasangiz, doimiy disk (persistent disk) pullik rejada bo'lishi va `DATA_DIR` shu diskka ko'rsatilishi shart.

---

# Qanday hisoblanadi (qisqacha)

- **Status**: farq = (joriy maqsad − ulush) ÷ maqsad × 100. ≥ +40% STRONG BUY, ≥ +20% BUY, ≤ −40% STRONG SELL, ≤ −20% SELL, qolgani HOLD.
- **Joriy maqsad** = turlar uchun F − (F/3)·SIGN(s)·|s|^1.316 (s = (1W Stoch RSI − 50)/50), foizli guruhlar uchun qolgan ulush normal ulushlarga mutanosib; yig'indi doim 100% (2.10.0 bo'limiga qarang).
- **BUY signali**: summa = hisob qiymati × normal% ÷ N (N = 3 odatiy, 5 HOLD, 7 qarama-qarshi), narxga bo'linadi. **SELL**: egalik qilinayotgan miqdor ÷ N. Qarama-qarshi kuchli status (STRONG SELL ga BUY, STRONG BUY ga SELL) rad etiladi. N qiymatlarini Sozlamalarda o'zgartirasiz.
- Qabul qilingan miqdorlar yig'iladi, birja qadamiga yaxlitlanadi, minimal summa tekshiriladi, keyin ulushga qarab mijozlarga taqsimlanadi. Birja komissiyasi (0.1%, milliy aksiyada 0.99%) ham ulushga qarab.
- **O'rtacha olish narxi** (Binance usuli): har BUY yangi o'rtachaga qo'shiladi, SELL va yechish o'rtachani o'zgartirmaydi.
- **Koeffitsient** = joriy qiymat ÷ (har bir kiritilgan pul yillik 25% bilan o'sganda bo'ladigan qiymat).
- **Xizmat haqi**: chorak foydasining 10%. Foyda = balans − (chorak ichida kiritilgan pul + oldingi chorak oxiridagi balans). Oldingi chorak balansini admin "Hisob sozlamalari" da kiritadi.
- Naqd so'm kerak: BUY uchun hisobda yetarli UZS bo'lishi kerak, aks holda bitim rad etiladi.
