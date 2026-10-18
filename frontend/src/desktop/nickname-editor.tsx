import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function NicknameEditor({
  nickname,
  placeholder,
  busy,
  onSave,
}: {
  nickname: string;
  placeholder: string;
  busy: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(nickname);
  const id = useId();
  return (
    <form
      className="nickname-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(value);
      }}
    >
      <label htmlFor={id}>메뉴 막대 별명</label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          maxLength={96}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={busy || value === nickname}
        >
          별명 저장
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        최대 24글자 · 메뉴 막대에는 8글자까지 · 비우면 기본 계정명의 앞 3글자
      </p>
    </form>
  );
}
