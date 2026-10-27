import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function MarkdownHelpModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-primary hover:text-primary/90 underline"
        >
          마크다운
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>마크다운 사용법</DialogTitle>
          <DialogDescription>
            마크다운 문법을 사용하여 게시물을 작성할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold mb-2">기본 서식</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <code className="bg-muted px-2 py-1 rounded">**굵게**</code> →{" "}
                <strong>굵게</strong>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">*기울임*</code> →{" "}
                <em>기울임</em>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">~~취소선~~</code> →{" "}
                <del>취소선</del>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">`코드`</code> →{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  코드
                </code>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">문단 나누기</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>
                <strong>중요:</strong> 문단을 나누려면 빈 줄(두 번의 줄바꿈)이
                필요합니다.
              </p>
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">
                  {`첫 번째 문단입니다.

두 번째 문단입니다.`}
                </pre>
              </div>
              <p className="text-xs">
                Enter 키를 한 번만 누르면 줄바꿈이 되지 않습니다. 문단을
                나누려면 Enter 키를 두 번 눌러 빈 줄을 만드세요.
              </p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">링크</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  [링크 텍스트](https://example.com)
                </code>{" "}
                → <span className="text-primary underline">링크 텍스트</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">목록</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <p className="mb-1">순서 없는 목록:</p>
                <div className="bg-muted p-3 rounded">
                  <pre className="text-xs">
                    {`- 항목 1
- 항목 2
- 항목 3`}
                  </pre>
                </div>
              </div>
              <div>
                <p className="mb-1">순서 있는 목록:</p>
                <div className="bg-muted p-3 rounded">
                  <pre className="text-xs">
                    {`1. 첫 번째
2. 두 번째
3. 세 번째`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">인용</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">{`> 인용문입니다.`}</pre>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">제목</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">
                  {`# 큰 제목
## 중간 제목
### 작은 제목`}
                </pre>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
