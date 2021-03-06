/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

declare module '@docusaurus/plugin-content-pages' {
  import type {RemarkAndRehypePluginOptions} from '@docusaurus/mdx-loader';

  export type PluginOptions = RemarkAndRehypePluginOptions & {
    id?: string;
    path: string;
    routeBasePath: string;
    include: string[];
    exclude: string[];
    mdxPageComponent: string;
    admonitions: Record<string, unknown>;
  };

  export type Options = Partial<PluginOptions>;
}

declare module '@theme/MDXPage' {
  import type {TOCItem} from '@docusaurus/types';

  export interface Props {
    readonly content: {
      readonly frontMatter: {
        readonly title: string;
        readonly description: string;
        readonly wrapperClassName?: string;
        readonly hide_table_of_contents?: string;
        readonly toc_min_heading_level?: number;
        readonly toc_max_heading_level?: number;
      };
      readonly metadata: {readonly permalink: string};
      readonly toc: readonly TOCItem[];
      (): JSX.Element;
    };
  }

  const MDXPage: (props: Props) => JSX.Element;
  export default MDXPage;
}
