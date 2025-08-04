import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:layout-dashboard',
      order: -1,
      title: $t('page.dashboard.title'),
      pageTitle: 'CSU KGs' // 添加 pageTitle，用于设置页面标题
    },
    name: 'Dashboard',
    path: '/',
    children: [
      {
        name: 'Workspace',
        path: '/workspace',
        component: () => import('#/views/dashboard/newworkspace/index.vue'),
        meta: {
          icon: 'carbon:workspace',
          title: $t('page.dashboard.workspace'),
          pageTitle: 'CSU KGs' // 添加 pageTitle，用于设置页面标题
        },
      },
    ],
  },
];

export default routes;
