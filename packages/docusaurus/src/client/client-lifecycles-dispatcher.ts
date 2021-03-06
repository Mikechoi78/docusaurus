/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import clientModules from '@generated/client-modules';

interface Dispatchers {
  onRouteUpdate: (...args: unknown[]) => void;
  onRouteUpdateDelayed: (...args: unknown[]) => void;
}

function dispatchLifecycleAction(
  lifecycleAction: keyof Dispatchers,
  ...args: unknown[]
) {
  clientModules.forEach((clientModule) => {
    const lifecycleFunction =
      clientModule?.default?.[lifecycleAction] ?? clientModule[lifecycleAction];

    if (lifecycleFunction) {
      lifecycleFunction(...args);
    }
  });
}

const clientLifecyclesDispatchers: Dispatchers = {
  onRouteUpdate(...args) {
    dispatchLifecycleAction('onRouteUpdate', ...args);
  },
  onRouteUpdateDelayed(...args) {
    dispatchLifecycleAction('onRouteUpdateDelayed', ...args);
  },
};

export default clientLifecyclesDispatchers;
