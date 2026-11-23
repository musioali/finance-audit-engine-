import { useRef } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button, Reveal, Vial } from '../ui';

const FACTS = [
  ['فقط خواندن', 'هیچ چیزی در نرم‌افزار حسابداری تغییر نمی‌کند.'],
  ['شواهد تا سطر', 'هر هشدار نام فایل و شمارهٔ سطر منبعش را نشان می‌دهد.'],
  ['روی همین رایانه', 'فایل‌ها به جایی فرستاده نمی‌شوند.'],
];

export default function Welcome({
  onFiles,
  onSample,
  onTemplates,
}: {
  onFiles: (files: FileList) => void;
  onSample: () => void;
  onTemplates: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] max-w-4xl flex-col items-center justify-center py-12 text-center">
      <Reveal>
        <Vial score={0} width={260} settle />
      </Reveal>
      <Reveal delay={0.1}>
        <h1 className="mt-10 text-[32px] font-extrabold leading-[1.35] md:text-[42px]">
          خرید و پرداخت‌ها را تراز کنید
        </h1>
      </Reveal>
      <Reveal delay={0.18}>
        <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-9 text-muted">
          فایل فاکتورها یا سفارش‌های خرید را بدهید. ترازبان همهٔ سطرها را بررسی می‌کند و هر مورد غیرعادی را با
          شواهدش به ترتیب اهمیت نشان می‌دهد.
        </p>
      </Reveal>
      <Reveal delay={0.26} className="mt-9 flex flex-wrap justify-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button icon={<Upload className="h-4 w-4" strokeWidth={1.5} />} onClick={() => input.current?.click()}>
          بارگذاری فایل
        </Button>
        <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" strokeWidth={1.5} />} onClick={onSample}>
          دیدن با دادهٔ نمونه
        </Button>
      </Reveal>
      <Reveal delay={0.32}>
        <button
          type="button"
          onClick={onTemplates}
          className="mt-4 min-h-11 cursor-pointer rounded-full px-4 text-[14px] font-semibold text-level underline-offset-4 hover:underline"
        >
          قالب فایل‌ها را ببینید
        </button>
      </Reveal>
      <Reveal delay={0.4} className="mt-12 grid w-full grid-cols-1 gap-3 text-right sm:grid-cols-3">
        {FACTS.map(([t, b]) => (
          <div key={t} className="rounded-[22px] bg-white/70 px-5 py-4 ring-1 ring-ink/[0.06]">
            <div className="text-[15px] font-bold">{t}</div>
            <div className="mt-1 text-[14px] leading-7 text-muted">{b}</div>
          </div>
        ))}
      </Reveal>
    </div>
  );
}
