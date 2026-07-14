import { useState } from "react";

interface Props {
  question: string;
  placeholder?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
}

/** Centered floating question; the user's answer renders inline as they type. */
export default function FloatingPrompt({ question, placeholder, initialValue, onSubmit }: Props) {
  const [value, setValue] = useState(initialValue ?? "");

  return (
    <form
      className="flex min-h-[90vh] flex-col items-center justify-center gap-8 px-6 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <h1 className="max-w-2xl text-3xl font-semibold text-violet-100 sm:text-4xl">
        {question}
      </h1>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full max-w-xl border-b-2 border-violet-500/40 bg-transparent pb-2 text-center text-2xl text-violet-50 placeholder-violet-300/30 outline-none transition-colors focus:border-violet-400"
      />
      <p className="text-sm text-violet-300/50">press Enter</p>
    </form>
  );
}
