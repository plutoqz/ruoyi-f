// use-mix-top-submenu.ts
// No major changes from the last version, but ensure it looks like this.
// The watch hook is the most important part.

import type { MenuRecordRaw } from '@vben/types';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { preferences, updatePreferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';
import { findRootMenuByPath } from '@vben/utils';
import { useNavigation } from './use-navigation';

export function useMixTopSubmenu() {
  const { navigation } = useNavigation();
  const accessStore = useAccessStore();
  const route = useRoute();

  const topSubMenus = ref<MenuRecordRaw[]>([]);
  const activePrimaryPath = ref<string>('');

  const isMixTopSubmenuNav = computed(
    () => preferences.app.layout === 'mix-top-submenu',
  );

  const menus = computed(() => accessStore.accessMenus);

  const sidePrimaryMenus = computed(() => {
    if (!isMixTopSubmenuNav.value) return [];
    return menus.value.map((item) => ({ ...item, children: [] }));
  });

  const activePrimary = computed(() => activePrimaryPath.value);
  const activeTopSub = computed(() => (route?.meta?.activePath as string) ?? route.path);

  const handlePrimaryMenuSelect = (key: string) => {
    const rootMenu = menus.value.find((item) => item.path === key);
    activePrimaryPath.value = rootMenu?.path ?? '';
    topSubMenus.value = rootMenu?.children ?? [];

    if (topSubMenus.value.length > 0) {
      navigation(topSubMenus.value[0].path);
    } else {
      navigation(key);
    }
  };

  const handleSubMenuSelect = (key: string) => {
    navigation(key);
  };

  function calcActiveMenus(path: string = route.path) {
    if (!isMixTopSubmenuNav.value || menus.value.length === 0) {
      activePrimaryPath.value = '';
      topSubMenus.value = [];
      return;
    }
    const { rootMenu } = findRootMenuByPath(menus.value, path);
    activePrimaryPath.value = rootMenu?.path ?? '';
    topSubMenus.value = rootMenu?.children ?? [];
  }

  // [!code focus:13]
  // This watch is CRITICAL. It forces the sidebar to be usable when this mode is on.
  watch(
    isMixTopSubmenuNav,
    (isNewMode) => {
      if (isNewMode) {
        updatePreferences({
          sidebar: {
            enable: true,
            hidden: false,
            collapsed: false,
          },
        });
        calcActiveMenus((route?.meta?.activePath as string) ?? route.path);
      }
    },
    { immediate: true },
  );

  watch(
    () => route.path,
    (path) => {
      if (isMixTopSubmenuNav.value) {
        calcActiveMenus((route?.meta?.activePath as string) ?? path);
      }
    },
    { immediate: true },
  );

  return {
    isMixTopSubmenuNav,
    sidePrimaryMenus,
    topSubMenus,
    activePrimary,
    activeTopSub,
    handlePrimaryMenuSelect,
    handleSubMenuSelect,
  };
}