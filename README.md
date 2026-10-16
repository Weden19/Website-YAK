# Website-YAK
VRChat Yakovlev academy group's website

## Английская версия

Страницы `/en/...` собираются из русских скриптом:

```bash
python3 .github/i18n/build_en.py
```

Перевод лежит в `.github/i18n/en_dict.py` (`EN` — тексты страниц, `EN_DECK` — слайды правил аватаров, `EN_SVG` — схема нашивок).
Если после правки русской страницы скрипт пишет «НЕ ПЕРЕВЕДЕНО», добавьте недостающие строки в словарь и запустите снова.
Английские слайды (`js/rules-deck-en.js`) пока обновляются вручную по `RULES_SLIDES_RU` из `js/rules-deck.js`.
