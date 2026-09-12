/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = {
  mainSidebar: [
    'index',
    {
      type: 'category',
      label: 'Quickstart',
      link: {
        type: 'generated-index',
        title: 'Quickstart',
        slug: '/category/quickstart',
        keywords: ['get started', 'quickstart'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: [
        'quickstart/installation',
        'quickstart/usage',
        'quickstart/intercept',
        'quickstart/approve',
      ],
    },
    'deployment',
    'upgrading-to-v2',
    {
      type: 'category',
      label: 'Configuration',
      link: {
        type: 'generated-index',
        title: 'Configuration',
        slug: '/category/configuration',
        keywords: ['config', 'configuration'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: ['configuration/overview', 'configuration/reference', 'configuration/pre-receive'],
    },
    {
      type: 'category',
      label: 'Architecture',
      link: {
        type: 'generated-index',
        title: 'Architecture',
        slug: '/category/architecture',
        keywords: ['architecture'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: [
        'architecture/architecture',
        'architecture/processors',
        'architecture/ssh-architecture',
      ],
    },
    {
      type: 'category',
      label: 'v3 architecture (draft)',
      link: {
        type: 'generated-index',
        title: 'v3 architecture (draft)',
        slug: '/category/v3',
        keywords: ['v3', 'architecture'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: [
        'v3/index',
        'v3/from-2x',
        'v3/push-lifecycle',
        'v3/identity',
        'v3/authorization',
        'v3/policy-contract',
        'v3/git-engine',
        'v3/data-model',
        'v3/service-api',
        'v3/hardening',
        'v3/scope',
        'v3/integration-plan',
        'v3/demo',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      link: {
        type: 'generated-index',
        title: 'Development',
        slug: '/category/development',
        keywords: ['dev', 'development'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: ['development/contributing', 'development/plugins', 'development/releases'],
    },
    'user-manual',
    'ssh-setup',
  ],
};
