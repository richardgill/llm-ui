import { Injectable } from '@angular/core';
import { List, Paragraph, Parent, Root, RootContent, Text } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfm } from 'micromark-extension-gfm';
import { isDeepEqual } from 'remeda';
import { visit } from 'unist-util-visit';

@Injectable({
  providedIn: 'root'
})
export class MarkdownParserService {

  public ZERO_WIDTH_SPACE = '\u200b';

  // enclosing symbols: _a_ __a__ *a* **a** ~a~ ~~a~~
  // _'s behave differently to * and ~.
  private ENCLOSING_START_REGEX = /(\*{1,3}|(^|\s|\n)_{1,3}|~{1,3})(\S|$)/;

  // Matches:
  // [
  // [a
  // [ab]
  // [ab](
  // [abc](ht
  // [abc](https://
  // [abc](https://a.com
  // [abc](https://a.com)
  private LINK_REGEX = /(\[$|\[[^\]]+$|\[[^\]]+\]$|\[[^\]]+\]\(.*$)/;

  constructor() { }

  private isEmptyList(list: List): boolean {
    return (
      list.children.length === 1 &&
      list.children[0].type === 'listItem' &&
      list.children[0].children.length === 0
    );
  }

  private isListCharacterLength(list: List, length: number): boolean {
    return Boolean(
      list.position &&
      list.position.start.line === list.position.end.line &&
      list.position.end.column &&
      list.position.start.column &&
      list.position.end.column - list.position.start.column === length,
    );
  }

  public markdownToAst(markdown: string): Root {
    return fromMarkdown(markdown, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    });
  }

  public astToMarkdown(markdownAst: Root): string {
    this.preserveWhitespaceInAst(markdownAst);
    return toMarkdown(markdownAst, { extensions: [gfmToMarkdown()] });
  }

  private afterLastNewline(markdown: string): string {
    const lastNewlineIndex = markdown.lastIndexOf('\n');
    return markdown.slice(lastNewlineIndex + 1);
  }

  private addZeroWidthSpaceAfterTrailingWhitespace(text: string): string {
    return text.replace(/ $/, ` ${this.ZERO_WIDTH_SPACE}`);
  }

  private removeZeroWidthSpaces(text: string): string {
    return text.replaceAll(this.ZERO_WIDTH_SPACE, '');
  }

  private preserveWhitespaceInAst(root: Root): Root {
    visit(root, 'text', (node, index, parent) => {
      if (parent && ['emphasis', 'strong', 'delete'].includes(parent.type)) {
        const indexWithinParent = parent.children.findIndex((n) => {
          return isDeepEqual(n.position, node.position);
        });
        const isLastChild = indexWithinParent === parent.children.length - 1;
        if (isLastChild) {
          node.value = this.addZeroWidthSpaceAfterTrailingWhitespace(node.value);
        }
      }
    });
    return root;
  }

  private removeRegexesFromParagraph(
    root: Root,
    paragraph: Paragraph,
    regexes: RegExp[],
  ) {
    regexes.forEach((regex) => {
      if (this.removeRegexFromParagraph(root, paragraph, regex)) {
        return;
      }
    });
  }

  private removeRegexFromParagraph(
    root: Root,
    paragraph: Paragraph,
    regex: RegExp,
  ): boolean {
    const partialAmbiguousEnclosingSymbolsIndex = paragraph.children.findIndex(
      (child) => {
        return child.type === 'text' && regex.test(this.afterLastNewline(child.value));
      },
    );
    if (partialAmbiguousEnclosingSymbolsIndex !== -1) {
      const match = paragraph.children[
        partialAmbiguousEnclosingSymbolsIndex
      ] as Text;
      const matchText = match.value;
      const matchIndex = regex.exec(matchText)!.index;

      if (matchIndex > 0) {
        paragraph.children[partialAmbiguousEnclosingSymbolsIndex] = {
          type: 'text',
          value: matchText.slice(0, matchIndex),
        };
        paragraph.children.splice(partialAmbiguousEnclosingSymbolsIndex + 1); // keep the updated text node, remove the rest
      } else {
        paragraph.children.splice(partialAmbiguousEnclosingSymbolsIndex); // delete the text node and the rest
      }
      // remove the 'lastChild' if it no longer has any children
      if (paragraph.children.length === 0) {
        root.children.splice(-1);
      }
    }
    return partialAmbiguousEnclosingSymbolsIndex !== -1;
  }

  // mutates the ast
  private removePartialAmbiguousMarkdownFromAst(root: Root): void {
    if (root.children.length === 0) {
      return;
    }
    const lastChild = root.children[root.children.length - 1];
    if (lastChild.type === 'paragraph') {
      this.removeRegexesFromParagraph(root, lastChild, [
        this.ENCLOSING_START_REGEX,
        this.LINK_REGEX,
      ]);
    } else if (
      // if there is an empty list item at the end, remove it
      lastChild.type === 'list' &&
      this.isEmptyList(lastChild) &&
      this.isListCharacterLength(lastChild, 1) // '*' is deleted, '* ' is not deleted.
    ) {
      root.children.splice(-1);
    } else if (lastChild.type === 'thematicBreak') {
      root.children.splice(-1);
    }
  }

  public removePartialAmbiguousMarkdown(markdown: string): string {
    const markdownAst = this.markdownToAst(markdown);
    this.removePartialAmbiguousMarkdownFromAst(markdownAst);
    return this.astToMarkdown(markdownAst);
  }

  private markdownAstToVisibleTextHelper(
    markdownAst: RootContentWithChildren,
  ): string {
    return markdownAst.children
      .map((child) => {
        if (child.type === 'text') {
          return child.value;
        }
        if (child.type === 'inlineCode') {
          return child.value;
        }
        if (child.type === 'thematicBreak') {
          return THEMATIC_BREAK_VISIBLE;
        }
        if (child.type === 'heading') {
          return this.markdownAstToVisibleTextHelper(child);
        }

        if (child.type === 'paragraph') {
          return this.markdownAstToVisibleTextHelper(child);
        }

        if (child.type === 'listItem') {
          return LIST_ITEM_VISIBLE + this.markdownAstToVisibleTextHelper(child);
        }
        if ('children' in child) {
          return this.markdownAstToVisibleTextHelper(child);
        }
        return '';
      })
      .join('');
  }

  private markdownAstToVisibleText(markdownAst: Root, isFinished: boolean) {
    if (!isFinished) {
      this.removePartialAmbiguousMarkdownFromAst(markdownAst);
    }
    return this.removeZeroWidthSpaces(
      this.markdownAstToVisibleTextHelper(markdownAst),
    ).replaceAll('\n', '');
    // mdast is not reliable with \n so we remove them all
  }

  public markdownToVisibleText(
    markdown: string,
    isFinished: boolean,
  ): string {
    const markdownAst = this.markdownToAst(markdown);
    return this.markdownAstToVisibleText(markdownAst, isFinished);
  }

  private removeVisibleCharsFromAstHelper(
    node: RootContent | Root,
    visibleCharsToRemove: number,
  ): { charsRemoved: number; toDelete: boolean } {
    if (node.type === 'text' || node.type === 'inlineCode') {
      if (node.value.length <= visibleCharsToRemove) {
        return { charsRemoved: node.value.length, toDelete: true };
      } else {
        node.value = node.value.slice(0, -1 * visibleCharsToRemove);
        return { charsRemoved: visibleCharsToRemove, toDelete: false };
      }
    }
    if (node.type === 'thematicBreak') {
      return { charsRemoved: THEMATIC_BREAK_VISIBLE.length, toDelete: true };
    }

    let removedCharsCount = 0;
    if ('children' in node) {
      // traverse children right to left
      let index = node.children.length - 1;
      while (index >= 0 && removedCharsCount < visibleCharsToRemove) {
        const child = node.children[index];

        const { charsRemoved, toDelete } = this.removeVisibleCharsFromAstHelper(
          child,
          visibleCharsToRemove - removedCharsCount,
        );
        removedCharsCount += charsRemoved;
        if (toDelete) {
          node.children.splice(index, 1); // delete the child
        }
        index--;
      }

      if (node.type === 'listItem') {
        const shouldDeleteListItem =
          node.children.length === 0 &&
          visibleCharsToRemove - removedCharsCount > 0;
        return {
          charsRemoved:
            removedCharsCount +
            (shouldDeleteListItem ? LIST_ITEM_VISIBLE.length : 0),
          toDelete: shouldDeleteListItem,
        };
      }

      return {
        charsRemoved: removedCharsCount,
        toDelete: node.children.length === 0,
      };
    }

    return { charsRemoved: 0, toDelete: false };
  }

  private removeVisibleCharsFromAst(
    node: Root,
    visibleCharsToRemove: number,
  ): void {
    const { toDelete } = this.removeVisibleCharsFromAstHelper(
      node,
      visibleCharsToRemove,
    );

    if (toDelete) {
      node.children = [];
    }
  }

  public markdownWithVisibleChars(
    markdown: string,
    visibleChars: number,
    isFinished: boolean,
  ): string {
    const markdownAst = this.markdownToAst(markdown);
    if (!isFinished) {
      this.removePartialAmbiguousMarkdownFromAst(markdownAst);
    }
    const visibleText = this.markdownAstToVisibleText(markdownAst, isFinished);
    const charsToRemove = visibleText.length - visibleChars;
    this.removeVisibleCharsFromAst(markdownAst, charsToRemove);
    return this.astToMarkdown(markdownAst);
  }
}

// Helper types (might need to be moved to a separate types.ts file)
type WithChildren<T> = T extends Parent ? T : never;
type RootContentWithChildren = WithChildren<RootContent> | Root;
const THEMATIC_BREAK_VISIBLE = '_'; // Should be a class member or const
const LIST_ITEM_VISIBLE = '*'; // Should be a class member or const
