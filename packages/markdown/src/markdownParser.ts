import { Parent, Root, RootContent, Text } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
// enclosing symbols: _a_ __a__ *a* **a** ~a~ ~~a~~
// _'s behave differently to * and ~.
const ENCLOSING_START = /(\*{1,3}|(^|\s|\n)_{1,3}|~{1,3})(\S|$)/;

const markdownToAst = (markdown: string): Root => {
  return fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
};

const astToMarkdown = (markdownAst: Root): string => {
  return toMarkdown(markdownAst, { extensions: [gfmToMarkdown()] });
};

const afterLastNewline = (markdown: string): string => {
  const lastNewlineIndex = markdown.lastIndexOf("\n");
  return markdown.slice(lastNewlineIndex + 1);
};

// mutates the ast
const removePartialAmbiguousMarkdownFromAst = (markdownAst: Root): void => {
  if (markdownAst.children.length === 0) {
    return;
  }
  const lastChild = markdownAst.children[markdownAst.children.length - 1];
  // console.log("ast", JSON.stringify(markdownAst, null, 2));
  // console.log("lastChild", JSON.stringify(lastChild, null, 2));

  // todo: not paragraph? (might be right)
  if (lastChild.type === "paragraph") {
    const partialAmbiguousEnclosingSymbolsIndex = lastChild.children.findIndex(
      (child) => {
        return (
          child.type === "text" &&
          ENCLOSING_START.test(afterLastNewline(child.value))
        );
      },
    );
    // console.log(
    //   "zzz partialAmbiguousEnclosingSymbolsIndex",
    //   partialAmbiguousEnclosingSymbolsIndex,
    // );
    if (partialAmbiguousEnclosingSymbolsIndex !== -1) {
      const match = lastChild.children[
        partialAmbiguousEnclosingSymbolsIndex
      ] as Text;
      const matchText = match.value;
      const matchIndex = ENCLOSING_START.exec(matchText)!.index;
      // console.log(
      //   "matchText",
      //   matchText,
      //   matchIndex,
      //   matchText.slice(0, matchIndex),
      // );
      if (matchIndex > 0) {
        lastChild.children[partialAmbiguousEnclosingSymbolsIndex] = {
          type: "text",
          value: matchText.slice(0, matchIndex),
        };
        // console.log("lastChild.children", lastChild.children);
        lastChild.children.splice(partialAmbiguousEnclosingSymbolsIndex + 1);
        // console.log("lastChild.children", lastChild.children);
      } else {
        lastChild.children.splice(partialAmbiguousEnclosingSymbolsIndex);
      }
      // remove the 'lastChild' if it no longer has any children
      if (lastChild.children.length === 0) {
        markdownAst.children.splice(-1);
      }
    }
  } else if (
    // if there is an empty list item at the end, remove it
    lastChild.type === "list" &&
    lastChild.children.length === 1 &&
    lastChild.children[0].type === "listItem" &&
    lastChild.children[0].children.length === 0
  ) {
    markdownAst.children.splice(-1);
  } else if (lastChild.type === "thematicBreak") {
    markdownAst.children.splice(-1);
  }
  // console.log("after ast", JSON.stringify(markdownAst, null, 2));
};

export const removePartialAmbiguousMarkdown = (markdown: string): string => {
  const markdownAst = markdownToAst(markdown);
  // console.log("markdownAst", JSON.stringify(markdownAst, null, 2));
  removePartialAmbiguousMarkdownFromAst(markdownAst);
  // console.log("markdownAst", JSON.stringify(markdownAst, null, 2));

  return astToMarkdown(markdownAst);
};

type WithChildren<T> = T extends Parent ? T : never;

type RootContentWithChildren = WithChildren<RootContent> | Root;

// todo: use constants here and reuse them in the remove function for less bugs (:
const markdownAstToVisibleTextHelper = (
  markdownAst: RootContentWithChildren,
): string => {
  return markdownAst.children
    .map((child) => {
      if (child.type === "text") {
        return child.value;
      }
      if (child.type === "thematicBreak") {
        return "_";
      }
      if (child.type === "heading") {
        return markdownAstToVisibleTextHelper(child);
      }

      if (child.type === "paragraph") {
        return markdownAstToVisibleTextHelper(child);
      }

      if (child.type === "listItem") {
        return "*" + markdownAstToVisibleTextHelper(child);
      }
      if ("children" in child) {
        return markdownAstToVisibleTextHelper(child);
      }
      return "";
    })
    .join("");
};

const markdownAstToVisibleText = (markdownAst: Root, isFinished: boolean) => {
  if (!isFinished) {
    removePartialAmbiguousMarkdownFromAst(markdownAst);
  }
  // console.log("markdownAst", JSON.stringify(markdownAst, null, 2));
  return markdownAstToVisibleTextHelper(markdownAst);
};

export const markdownToVisibleText = (
  markdown: string,
  isFinished: boolean,
): string => {
  const markdownAst = markdownToAst(markdown);
  // console.log("markdownAst", JSON.stringify(markdownAst, null, 2));
  return markdownAstToVisibleText(markdownAst, isFinished);
};

const removeVisibleCharsFromAstHelper = (
  node: RootContent | Root,
  visibleCharsToRemove: number,
): { charsRemoved: number; toDelete: boolean } => {
  // console.log("---\nhelper ast", JSON.stringify(node, null, 2));

  if (node.type === "text") {
    if (node.value.length <= visibleCharsToRemove) {
      return { charsRemoved: node.value.length, toDelete: true };
    } else {
      node.value = node.value.slice(0, -1 * visibleCharsToRemove);
      return { charsRemoved: visibleCharsToRemove, toDelete: false };
    }
  }
  if (node.type === "thematicBreak") {
    return { charsRemoved: 1, toDelete: true };
  }
  //  if (child.type === "heading") {
  //    removedChars += 1; // the newline
  //  }
  let removedCharsCount = 0;
  if ("children" in node) {
    // right to left
    for (let index = node.children.length - 1; index >= 0; index--) {
      const child = node.children[index];
      if (removedCharsCount >= visibleCharsToRemove) {
        break;
      }

      const { charsRemoved, toDelete } = removeVisibleCharsFromAstHelper(
        child,
        visibleCharsToRemove - removedCharsCount,
      );
      removedCharsCount += charsRemoved;
      if (toDelete) {
        node.children.splice(index, 1);
      }
    }
    return {
      charsRemoved: removedCharsCount,
      toDelete: node.children.length === 0,
    };
  }

  return { charsRemoved: 0, toDelete: false };
};

const removeVisibleCharsFromAst = (
  node: Root,
  visibleCharsToRemove: number,
): void => {
  const { toDelete } = removeVisibleCharsFromAstHelper(
    node,
    visibleCharsToRemove,
  );
  // console.log("---\nfinished ast", JSON.stringify(node, null, 2));

  if (toDelete) {
    node.children = [];
  }
};

// This function operates on a complete markdown string
export const markdownRemoveChars = (
  markdown: string,
  maxCharsToRemove: number,
): string => {
  const markdownAst = markdownToAst(markdown);
  removeVisibleCharsFromAst(markdownAst, maxCharsToRemove);
  return astToMarkdown(markdownAst);
};

export const markdownWithVisibleChars = (
  markdown: string,
  visibleChars: number,
  isFinished: boolean,
): string => {
  const markdownAst = markdownToAst(markdown);
  if (!isFinished) {
    removePartialAmbiguousMarkdownFromAst(markdownAst);
  }
  const visibleText = markdownAstToVisibleText(markdownAst, isFinished);

  const charsToRemove = visibleText.length - visibleChars;
  removeVisibleCharsFromAst(markdownAst, charsToRemove);

  return astToMarkdown(markdownAst);
};
