/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {matchRoutes, RouteConfig as RRRouteConfig} from 'react-router-config';
import resolvePathname from 'resolve-pathname';
import chalk from 'chalk';
import fs from 'fs-extra';
import {mapValues, pickBy, flatMap} from 'lodash';
import {RouteConfig, OnBrokenLinks} from '@docusaurus/types';
import {removePrefix} from '@docusaurus/utils';

function toReactRouterRoutes(routes: RouteConfig[]): RRRouteConfig[] {
  // @ts-expect-error: types incompatible???
  return routes as RRRouteConfig[];
}

type BrokenLink = {
  link: string;
  resolvedLink: string;
};

// matchRoutes does not support qs/anchors, so we remove it!
function onlyPathname(link: string) {
  return link.split('#')[0].split('?')[0];
}

function getPageBrokenLinks({
  pagePath,
  pageLinks,
  routes,
}: {
  pagePath: string;
  pageLinks: string[];
  routes: RouteConfig[];
}): BrokenLink[] {
  // ReactRouter is able to support links like ./../somePath
  // but matchRoutes does not do this resolving internally
  // we must resolve the links before using matchRoutes
  // resolvePathname is used internally by ReactRouter
  function resolveLink(link: string) {
    const resolvedLink = resolvePathname(onlyPathname(link), pagePath);
    return {link, resolvedLink};
  }

  function isBrokenLink(link: string) {
    const matchedRoutes = matchRoutes(toReactRouterRoutes(routes), link);
    return matchedRoutes.length === 0;
  }

  return pageLinks.map(resolveLink).filter((l) => isBrokenLink(l.resolvedLink));
}

// The route defs can be recursive, and have a parent match-all route
// We don't want to match broken links like /docs/brokenLink against /docs/*
// For this reason, we only consider the "final routes", that do not have subroutes
// We also need to remove the match all 404 route
function filterIntermediateRoutes(routesInput: RouteConfig[]): RouteConfig[] {
  function getFinalRoutes(route: RouteConfig): RouteConfig[] {
    return route.routes ? flatMap(route.routes, getFinalRoutes) : [route];
  }

  const routesWithout404 = routesInput.filter((route) => route.path !== '*');
  return flatMap(routesWithout404, getFinalRoutes);
}

export function getAllBrokenLinks({
  allCollectedLinks,
  routes,
}: {
  allCollectedLinks: Record<string, string[]>;
  routes: RouteConfig[];
}): Record<string, BrokenLink[]> {
  const filteredRoutes = filterIntermediateRoutes(routes);

  const allBrokenLinks = mapValues(allCollectedLinks, (pageLinks, pagePath) => {
    return getPageBrokenLinks({pageLinks, pagePath, routes: filteredRoutes});
  });

  // remove pages without any broken link
  return pickBy(allBrokenLinks, (brokenLinks) => brokenLinks.length > 0);
}

export function getBrokenLinksErrorMessage(
  allBrokenLinks: Record<string, BrokenLink[]>,
): string | undefined {
  if (Object.keys(allBrokenLinks).length === 0) {
    return undefined;
  }

  function brokenLinkMessage(brokenLink: BrokenLink): string {
    const showResolvedLink = brokenLink.link !== brokenLink.resolvedLink;
    return `${brokenLink.link}${
      showResolvedLink ? ` (resolved as: ${brokenLink.resolvedLink})` : ''
    }`;
  }

  function pageBrokenLinksMessage(
    pagePath: string,
    brokenLinks: BrokenLink[],
  ): string {
    return `\n\n- Page path = ${pagePath}:\n   -> link to ${brokenLinks
      .map(brokenLinkMessage)
      .join('\n   -> link to ')}`;
  }

  return (
    `Broken links found!` +
    `${Object.entries(allBrokenLinks)
      .map(([pagePath, brokenLinks]) =>
        pageBrokenLinksMessage(pagePath, brokenLinks),
      )
      .join('\n')}
`
  );
}

// If a file actually exist on the file system, we know the link is valid
// even if docusaurus does not know about this file, so we don't report it
async function filterExistingFileLinks({
  baseUrl,
  outDir,
  allCollectedLinks,
}: {
  baseUrl: string;
  outDir: string;
  allCollectedLinks: Record<string, string[]>;
}): Promise<Record<string, string[]>> {
  // not easy to make this async :'(
  function linkFileDoesNotExist(link: string): boolean {
    const filePath = `${outDir}/${removePrefix(link, baseUrl)}`;
    const exists = fs.existsSync(filePath);
    return !exists;
  }

  return mapValues(allCollectedLinks, (links) => {
    return links.filter(linkFileDoesNotExist);
  });
}

export async function handleBrokenLinks({
  allCollectedLinks,
  onBrokenLinks,
  routes,
  baseUrl,
  outDir,
}: {
  allCollectedLinks: Record<string, string[]>;
  onBrokenLinks: OnBrokenLinks;
  routes: RouteConfig[];
  baseUrl: string;
  outDir: string;
}) {
  if (onBrokenLinks === 'ignore') {
    return;
  }

  // If we link to a file like /myFile.zip, and the file actually exist for the file system
  // it is not a broken link, it may simply be a link to an existing static file...
  const allCollectedLinksFiltered = await filterExistingFileLinks({
    allCollectedLinks,
    baseUrl,
    outDir,
  });

  const allBrokenLinks = getAllBrokenLinks({
    allCollectedLinks: allCollectedLinksFiltered,
    routes,
  });

  const errorMessage = getBrokenLinksErrorMessage(allBrokenLinks);
  if (errorMessage) {
    const finalMessage = `${errorMessage}\nNote: it's possible to ignore broken links with the 'onBrokenLinks' Docusaurus configuration.\n\n`;

    // Useful to ensure the CI fails in case of broken link
    if (onBrokenLinks === 'throw') {
      throw new Error(finalMessage);
    } else if (onBrokenLinks === 'error') {
      console.error(chalk.red(finalMessage));
    } else if (onBrokenLinks === 'log') {
      console.log(chalk.blue(finalMessage));
    } else {
      throw new Error(`unexpected onBrokenLinks value=${onBrokenLinks}`);
    }
  }
}
