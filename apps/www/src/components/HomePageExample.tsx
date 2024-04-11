import { useStreamFastSmooth } from "@/hooks/useLLMExamples";
import { cn } from "@/lib/utils";
import {
  buildShikiCodeBlockComponent,
  codeBlockCompleteMatcher,
  codeBlockLookBack,
  loadHighlighter,
} from "@llm-ui/code-block";
import {
  allLangs,
  allLangsAlias,
} from "@llm-ui/code-block/shikiBundles/allLangs";
import { MarkdownComponent, markdownLookBack } from "@llm-ui/markdown";
import {
  LLMOutput,
  type LLMOutputBlock,
  type LLMOutputComponent,
} from "llm-ui/components";
import { Check, Copy } from "lucide-react";
import { codeBlockPartialMatcher } from "node_modules/@llm-ui/code-block/src/matchers";
import type {
  ShikiCodeBlockComponent,
  ShikiProps,
} from "node_modules/@llm-ui/code-block/src/shikiComponent";
import type { ThrottleFunction } from "node_modules/llm-ui/src/components/LLMOutput/types";
import { useState, type ReactNode } from "react";
import { getHighlighterCore } from "shiki/core";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import getWasm from "shiki/wasm";
import { Button } from "./ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/Tabs";
import { H2 } from "./ui/Text";

const example = `### Markdown support ✅

- [links](https://llm-ui.com)
- ~strikethrough~, *italic*, **bold**

#### Code blocks:

\`\`\`typescript
import { LLMOutput } from "llm-ui/components";

console.log('Hello llm-ui');
console.log('Hello llm-ui');
console.log('Hello llm-ui');
console.log('Hello llm-ui');
console.log('Hello llm-ui');
console.log('Hello llm-ui');
\`\`\`
`;
const Markdown: LLMOutputComponent = (props) => {
  return <MarkdownComponent {...props} className={"prose dark:prose-invert"} />;
};

const shikiProps: ShikiProps = {
  highlighter: loadHighlighter(
    getHighlighterCore({
      langs: allLangs,
      langAlias: allLangsAlias,
      themes: [githubLight, githubDark],
      loadWasm: getWasm,
    }),
  ),
  codeToHtmlProps: { themes: { light: "github-light", dark: "github-dark" } },
};

const CodeBlock = buildShikiCodeBlockComponent(shikiProps);

const CodeBlockContainer: React.FC<{
  code: string;
  isComplete: boolean;
  children: ReactNode;
}> = ({ code, children }) => {
  const [isCopied, setIsCopied] = useState(false);
  const Icon = isCopied ? Check : Copy;
  const text = isCopied ? "Copied" : "Copy";
  return (
    <div className="relative group my-4">
      <Button
        className={cn(
          "absolute top-3 end-3 min-w-24 !transition-opacity !ease-in !duration-150 group-hover:opacity-100 ",
          isCopied ? "opacity-100" : "opacity-0",
        )}
        size={"sm"}
        variant={"secondary"}
        onClick={() => {
          navigator.clipboard.writeText(code);
          setIsCopied(true);
          setTimeout(() => {
            setIsCopied(false);
          }, 1400);
        }}
      >
        <Icon className="mr-2 h-4 w-4" />
        {text}
      </Button>
      {children}
    </div>
  );
};

const ShikiComplete: ShikiCodeBlockComponent = (props) => {
  return (
    <CodeBlockContainer code={props.llmOutput} isComplete>
      <CodeBlock {...props} />
    </CodeBlockContainer>
  );
};

const codeBlockBlock: LLMOutputBlock = {
  isCompleteMatch: codeBlockCompleteMatcher(),
  isPartialMatch: codeBlockPartialMatcher(),
  lookBack: codeBlockLookBack(),
  component: ShikiComplete,
};

const throttle: ThrottleFunction = ({
  outputAll,
  outputRendered,
  timeInMsSinceLastRender,
  isStreamFinished,
  visibleText,
}) => {
  const bufferSize = outputAll.length - outputRendered.length;
  return {
    skip: (!isStreamFinished && bufferSize < 10) || timeInMsSinceLastRender < 4,
    visibleTextLengthTarget: visibleText.length + 1,
  };
};

const SideBySideContainer: React.FC<{
  className?: string;
  header: ReactNode;
  children: ReactNode;
}> = ({ className, header, children }) => {
  return (
    <div className={cn(className, "overflow-x-hidden flex-1 ")}>
      {header}
      {children}
    </div>
  );
};

const CodeWithBackground: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <div className="rounded-lg bg-background p-6 min-h-[500px]">{children}</div>
);

type SideBySideTabsProps = {
  output: string;
  llmUi: ReactNode;
  className?: string;
};

const MobileSideBySideTabs: React.FC<SideBySideTabsProps> = (props) => (
  <SideBySideTabs {...props} isMobile />
);

const SideBySideTabs: React.FC<
  SideBySideTabsProps & {
    isMobile?: boolean;
  }
> = ({ className, output, llmUi, isMobile = false }) => {
  return (
    <Tabs defaultValue={isMobile ? "llm-ui" : "markdown"} className={className}>
      {isMobile && <TabsContent value="llm-ui">{llmUi}</TabsContent>}
      <TabsContent value="markdown">
        <CodeWithBackground>
          <Markdown isComplete={false} llmOutput={output} />
        </CodeWithBackground>
      </TabsContent>
      <TabsContent value="raw">
        <CodeWithBackground>
          <pre className="overflow-x-auto">{output}</pre>
        </CodeWithBackground>
      </TabsContent>
      <div className="flex flex-row items-center mt-6">
        <TabsList>
          {isMobile && (
            <TabsTrigger value="llm-ui" className="md:hidden">
              llm-ui
            </TabsTrigger>
          )}
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
      </div>
    </Tabs>
  );
};

export const HomePageExample = () => {
  const { output, isFinished } = useStreamFastSmooth(example, {
    loop: true,
    autoStart: true,
    loopDelayMs: 5000,
  });
  // todo:  controls, buttons for markdown and raw?
  const llmUi = (
    <CodeWithBackground>
      <LLMOutput
        blocks={[codeBlockBlock]}
        isFinished={isFinished}
        fallbackComponent={{
          component: Markdown,
          lookBack: markdownLookBack,
        }}
        llmOutput={output}
        throttle={throttle}
      />
    </CodeWithBackground>
  );
  return (
    <div className="flex flex-row gap-8 h-[640px]">
      <SideBySideContainer
        header={
          <H2 className="mb-8 text-muted-foreground text-center">LLM Output</H2>
        }
      >
        <SideBySideTabs
          className="hidden md:block"
          output={output}
          llmUi={llmUi}
        />
        <MobileSideBySideTabs
          className="md:hidden"
          output={output}
          llmUi={llmUi}
        />
      </SideBySideContainer>
      <SideBySideContainer
        className="hidden md:block"
        header={
          <H2 className="mb-8 text-center">
            <span className="text-gradient_indigo-purple">llm-ui</span> ✨
          </H2>
        }
      >
        {llmUi}
      </SideBySideContainer>
    </div>
  );
};
