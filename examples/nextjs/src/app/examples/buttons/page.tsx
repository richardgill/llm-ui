"use client";
import {
  buttonsLookBack,
  findCompleteButtons,
  findPartialButtons,
  parseCompleteButtons,
} from "@llm-ui/buttons";
import { markdownLookBack } from "@llm-ui/markdown";
import { useLLMOutput, type LLMOutputComponent } from "@llm-ui/react/core";
import { useStreamExample } from "@llm-ui/react/examples";
import ReactMarkdown, { type Options } from "react-markdown";
import remarkGfm from "remark-gfm";

// --- Markdown setup start ---

// Customize this component with your own styling
const MarkdownComponent: LLMOutputComponent<Options> = ({
  blockMatch,
  ...props
}) => {
  const markdown = blockMatch.output;
  return (
    <ReactMarkdown
      {...props}
      remarkPlugins={[...(props.remarkPlugins ?? []), remarkGfm]}
    >
      {markdown}
    </ReactMarkdown>
  );
};
// --- Markdown setup end ---

// --- Buttons block setup start ---

// Customize this component with your own styling
const ButtonsComponent: LLMOutputComponent = ({ blockMatch }) => {
  const buttons = parseCompleteButtons(blockMatch.output);
  if (!buttons) {
    return undefined;
  }
  return (
    <div>
      {buttons.map((button, index) => (
        <button key={index}>{button}</button>
      ))}
    </div>
  );
};
// --- Buttons block setup end ---

const example = `
## Example

<buttons><button>Button 1</button><button>Button 2</button></buttons>
`;

const Example = () => {
  const { isStreamFinished, output } = useStreamExample(example, {
    delayMultiplier: 0,
  });

  const { blockMatches } = useLLMOutput({
    llmOutput: output,
    blocks: [
      {
        component: ButtonsComponent,
        findPartialMatch: findPartialButtons(),
        findCompleteMatch: findCompleteButtons(),
        lookBack: buttonsLookBack(),
      },
    ],
    fallbackBlock: {
      component: MarkdownComponent,
      lookBack: markdownLookBack(),
    },
    isStreamFinished,
  });

  return (
    <div>
      {blockMatches.map((blockMatch, index) => {
        const Component = blockMatch.block.component;
        return <Component key={index} blockMatch={blockMatch} />;
      })}
    </div>
  );
};

export default Example;
