// Hiển thị tên / mô tả sản phẩm theo ngôn ngữ đang chọn.
// Thứ tự ưu tiên: từ điển dịch sẵn (PRODUCT_NAMES) → dịch tự động có cache → tiếng Việt gốc.
import { useEffect, useState } from 'react';
import { useLang } from './LanguageContext';
import { translateText } from './autoTranslate';
import { PRODUCT_NAMES } from './translations/productNames';

function useTranslatedField(product, field) {
  const { lang } = useLang();
  const source = product?.[field] || '';
  const [text, setText] = useState(source);

  useEffect(() => {
    if (!product || lang === 'vi' || !source) { setText(source); return; }
    if (field === 'name') {
      const hit = PRODUCT_NAMES[source]?.[lang];
      if (hit) { setText(hit); return; }
    }
    let alive = true;
    setText(source); // hiện tạm tiếng Việt trong lúc chờ dịch
    translateText(source, lang).then((t) => { if (alive) setText(t); });
    return () => { alive = false; };
  }, [product?.id, source, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return text;
}

/** Tên sản phẩm theo ngôn ngữ. Dùng thay cho {product.name} ở mọi chỗ hiển thị cho khách. */
export function useProductName(product) {
  return useTranslatedField(product, 'name');
}

/** Mô tả sản phẩm theo ngôn ngữ. Dùng thay cho {product.description}. */
export function useProductDesc(product) {
  return useTranslatedField(product, 'description');
}

/** Component hiển thị tên SP đã dịch (dùng trong JSX). */
export function PName({ product, ...rest }) {
  const name = useProductName(product);
  return <span {...rest}>{name}</span>;
}

/** Component hiển thị mô tả SP đã dịch (dùng trong JSX). */
export function PDesc({ product, ...rest }) {
  const desc = useProductDesc(product);
  return <span {...rest}>{desc}</span>;
}

/** Dịch một chuỗi tiếng Việt bất kỳ (VD: tên danh mục từ DB) sang ngôn ngữ hiện tại. */
export function useTranslatedText(text) {
  const { lang } = useLang();
  const [out, setOut] = useState(text || '');
  useEffect(() => {
    if (!text || lang === 'vi') { setOut(text || ''); return; }
    let alive = true;
    setOut(text);
    translateText(text, lang).then((t) => { if (alive) setOut(t); });
    return () => { alive = false; };
  }, [text, lang]);
  return out;
}
