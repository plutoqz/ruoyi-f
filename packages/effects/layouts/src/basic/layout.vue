<script lang="ts" setup>
import type { MenuRecordRaw } from '@vben/types';
import { computed, useSlots, watch } from 'vue';
import { useWatermark } from '@vben/hooks';
import { $t } from '@vben/locales';
import {
  preferences,
  updatePreferences,
  usePreferences,
} from '@vben/preferences';
import { useAccessStore, useLockStore, useUserStore } from '@vben/stores';
import { deepToRaw, mapTree } from '@vben/utils';
import { VbenAdminLayout } from '@vben-core/layout-ui';
import { Toaster, VbenBackTop, VbenLogo } from '@vben-core/shadcn-ui';
import { Breadcrumb, CheckUpdates, Preferences } from '../widgets';
import { LayoutContent, LayoutContentSpinner } from './content';
import { Copyright } from './copyright';
import { LayoutFooter } from './footer';
import { LayoutHeader } from './header';
import {
  LayoutExtraMenu,
  LayoutMenu,
  LayoutMixedMenu,
  useExtraMenu,
  useMixedMenu,
  useMixTopSubmenu,
} from './menu';
import { LayoutTabbar } from './tabbar';

defineOptions({ name: 'BasicLayout' });

const emit = defineEmits<{ clearPreferencesAndLogout: [] }>();

const {
  isDark,
  isHeaderNav,
  isMixedNav,
  isMobile,
  isSideMixedNav,
  layout, // The user's intended layout from preferences
  preferencesButtonPosition,
  sidebarCollapsed,
  theme,
} = usePreferences();
const userStore = useUserStore();
const { updateWatermark } = useWatermark();
const lockStore = useLockStore();
const accessStore = useAccessStore();

// --- HOOKS ---
const {
  handleMenuSelect: handleMixedMenuSelectOriginal,
  headerActive: mixedHeaderActive,
  headerMenus: mixedHeaderMenus,
  sidebarActive: mixedSidebarActive,
  sidebarMenus: mixedSidebarMenus,
} = useMixedMenu();

const {
  isMixTopSubmenuNav,
  sidePrimaryMenus,
  topSubMenus,
  activePrimary,
  activeTopSub,
  handlePrimaryMenuSelect,
  handleSubMenuSelect,
} = useMixTopSubmenu();

// --- COMPUTED PROPERTIES (THE CORE FIX) ---

// [!code focus:11]
/**
 * [CRITICAL FIX 1] Determine the layout to pass to the VbenAdminLayout component.
 * If our custom mode is active, we FORCE the component to use 'mixed-nav'.
 * This guarantees the component renders the necessary HTML structure (a sidebar).
 * Otherwise, we use the actual selected layout.
 */
const effectiveLayout = computed(() => {
  if (isMixTopSubmenuNav.value) {
    return 'mixed-nav'; // Force a layout the component understands
  }
  return layout.value;
});

/**
 * [CRITICAL FIX 2] A simple, reliable flag for sidebar visibility.
 * It's true if the sidebar is globally enabled AND not hidden.
 */
// [!code focus:4]
const isSidebarEffectivelyVisible = computed(() => {
  return preferences.sidebar.enable && !preferences.sidebar.hidden;
});

// [!code focus:22]
/**
 * [CRITICAL FIX 3] The "Content Swap" logic.
 * We feed the correct menu data into the slots based on the REAL layout mode.
 */
const finalHeaderMenus = computed(() => {
  if (isHeaderNav.value) return fullMenus.value;
  // If our new mode is active, the header gets the SUB menus.
  if (isMixTopSubmenuNav.value) return topSubMenus.value;
  // If the original mixed mode is active, the header gets the PRIMARY menus.
  if (isMixedNav.value) return mixedHeaderMenus.value;
  return [];
});

const finalSidebarMenus = computed(() => {
  // If our new mode is active, the sidebar gets the PRIMARY menus.
  if (isMixTopSubmenuNav.value) return sidePrimaryMenus.value;
  // If the original mixed mode is active, the sidebar gets the SUB menus.
  if (isMixedNav.value || isSideMixedNav.value) return mixedSidebarMenus.value;
  if (layout.value === 'sidebar-nav') return fullMenus.value;
  return [];
});

const finalHeaderActive = computed(() => {
  if (isMixTopSubmenuNav.value) return activeTopSub.value;
  return mixedHeaderActive.value;
});

const finalSidebarActive = computed(() => {
  if (isMixTopSubmenuNav.value) return activePrimary.value;
  return mixedSidebarActive.value;
});


// --- Other computed properties ---
const sidebarTheme = computed(() => (isDark.value || preferences.theme.semiDarkSidebar ? 'dark' : 'light'));
const headerTheme = computed(() => (isDark.value || preferences.theme.semiDarkHeader ? 'dark' : 'light'));
const fullMenus = computed(() => accessStore.accessMenus);
const showHeaderNav = computed(() => !isMobile.value && (isHeaderNav.value || isMixedNav.value || isMixTopSubmenuNav.value));
const logoCollapsed = computed(() => {
  if (isMobile.value && sidebarCollapsed.value) return true;
  if (showHeaderNav.value) return false;
  return sidebarCollapsed.value || isSideMixedNav.value;
});
const logoClass = computed(() => {
  const classes: string[] = [];
  if (preferences.sidebar.collapsedShowTitle && sidebarCollapsed.value && !isMixedNav.value) classes.push('mx-auto');
  if (isSideMixedNav.value) classes.push('flex-center');
  return classes.join(' ');
});
const isMenuRounded = computed(() => preferences.navigation.styleType === 'rounded');

// --- Side-mixed-nav logic ---
const {
  extraActiveMenu, extraMenus, handleDefaultSelect,
  handleMenuMouseEnter, handleMixedMenuSelect,
  handleSideMouseLeave, sidebarExtraVisible,
} = useExtraMenu();


// --- METHODS ---
function wrapperMenus(menus: MenuRecordRaw[]) {
  return mapTree(menus, (item) => ({ ...deepToRaw(item), name: $t(item.name) }));
}

function handleFinalMenuSelect(key: string, mode?: string) {
  if (isMixTopSubmenuNav.value) {
    if (mode === 'vertical') handlePrimaryMenuSelect(key);
    else handleSubMenuSelect(key);
  } else if (isSideMixedNav.value) {
    handleMixedMenuSelect(key);
  } else {
    handleMixedMenuSelectOriginal(key, mode);
  }
}

function toggleSidebar() {
  updatePreferences({ sidebar: { hidden: !preferences.sidebar.hidden } });
}

function clearPreferencesAndLogout() {
  emit('clearPreferencesAndLogout');
}

watch(() => preferences.app.watermark, async (val) => {
  if (val) await updateWatermark({ content: `${userStore.userInfo?.username}` });
}, { immediate: true });

const slots = useSlots();
const headerSlots = computed(() => slots && Object.keys(slots).filter((key) => key.startsWith('header-')));

</script>

<template>
  <VbenAdminLayout
    :header-visible="preferences.header.enable"
    :header-hidden="preferences.header.hidden"
    :header-theme="headerTheme"
    :header-mode="preferences.header.mode"
    :header-toggle-sidebar-button="preferences.widget.sidebarToggle"
    :tabbar-enable="preferences.tabbar.enable"
    :tabbar-height="preferences.tabbar.height"
    :footer-enable="preferences.footer.enable"
    :footer-fixed="preferences.footer.fixed"
    :is-mobile="preferences.app.isMobile"
    :content-compact="preferences.app.contentCompact"
    :sidebar-theme="sidebarTheme"
    :sidebar-width="preferences.sidebar.width"
    v-model:sidebar-collapse="preferences.sidebar.collapsed"
    :sidebar-collapse-show-title="preferences.sidebar.collapsedShowTitle"
    :sidebar-expand-on-hover="preferences.sidebar.expandOnHover"
    v-model:sidebar-extra-visible="sidebarExtraVisible"
    :sidebar-extra-collapse="preferences.sidebar.extraCollapse"
    @toggle-sidebar="toggleSidebar"
    @side-mouse-leave="handleSideMouseLeave"
    


    :layout="effectiveLayout"

    :sidebar-enable="isSidebarEffectivelyVisible"
  >
    <!-- logo -->
    <template #logo>
      <VbenLogo
        v-if="preferences.logo.enable"
        :class="logoClass"
        :collapsed="logoCollapsed"
        :src="'/favicon.ico'"
        :text="'自然资源时空知识服务系统'"
        :text-size="13"
        :theme="showHeaderNav ? headerTheme : theme"
      />
    </template>
    
    <!-- Header: Its content is now dynamically swapped -->
    <template #header>
      <LayoutHeader :theme="theme" @clear-preferences-and-logout="clearPreferencesAndLogout">
        <template v-if="!showHeaderNav && preferences.breadcrumb.enable" #breadcrumb>
          <Breadcrumb :hide-when-only-one="preferences.breadcrumb.hideOnlyOne" :show-home="preferences.breadcrumb.showHome" :show-icon="preferences.breadcrumb.showIcon" :type="preferences.breadcrumb.styleType" />
        </template>
        <template v-if="showHeaderNav" #menu>
          <LayoutMenu
            :default-active="finalHeaderActive"
            :menus="wrapperMenus(finalHeaderMenus)"
            :rounded="isMenuRounded"
            :theme="headerTheme"
            class="w-full"
            mode="horizontal"
            @select="(key) => handleFinalMenuSelect(key, 'horizontal')"
          />
        </template>
        <template #user-dropdown><slot name="user-dropdown"></slot></template>
        <template #notification><slot name="notification"></slot></template>
        <template v-for="item in headerSlots" #[item]><slot :name="item"></slot></template>
      </LayoutHeader>
    </template>
    
    <!-- Sidebar Menu: Its content is now dynamically swapped -->
    <template #menu>
      <LayoutMenu
        :accordion="preferences.navigation.accordion"
        :collapse="preferences.sidebar.collapsed"
        :collapse-show-title="preferences.sidebar.collapsedShowTitle"
        :default-active="finalSidebarActive"
        :menus="wrapperMenus(finalSidebarMenus)"
        :rounded="isMenuRounded"
        :theme="sidebarTheme"
        mode="vertical"
        @select="(key) => handleFinalMenuSelect(key, 'vertical')"
      />
    </template>

    <!-- Other slots remain the same -->
    <template #mixed-menu>
      <LayoutMixedMenu :active-path="extraActiveMenu" :menus="wrapperMenus(mixedHeaderMenus)" :rounded="isMenuRounded" :theme="sidebarTheme" @default-select="handleDefaultSelect" @enter="handleMenuMouseEnter" @select="handleMixedMenuSelect" />
    </template>
    <template #side-extra>
      <LayoutExtraMenu :accordion="preferences.navigation.accordion" :collapse="preferences.sidebar.extraCollapse" :menus="wrapperMenus(extraMenus)" :rounded="isMenuRounded" :theme="sidebarTheme" />
    </template>
    <template #side-extra-title>
      <VbenLogo v-if="preferences.logo.enable" :text="preferences.app.name" :theme="theme" />
    </template>
    <template #tabbar>
      <LayoutTabbar v-if="preferences.tabbar.enable" :show-icon="preferences.tabbar.showIcon" :theme="theme" />
    </template>
    <template #content>
      <LayoutContent />
    </template>
    <template v-if="preferences.transition.loading" #content-overlay>
      <LayoutContentSpinner />
    </template>
    <template v-if="preferences.footer.enable" #footer>
      <LayoutFooter>
        <Copyright v-if="preferences.copyright.enable" v-bind="preferences.copyright" />
      </LayoutFooter>
    </template>
    <template #extra>
      <slot name="extra"></slot>
      <Toaster />
      <CheckUpdates v-if="preferences.app.enableCheckUpdates" :check-updates-interval="preferences.app.checkUpdatesInterval" />
      <Transition v-if="preferences.widget.lockScreen" name="slide-up">
        <slot v-if="lockStore.isLockScreen" name="lock-screen"></slot>
      </Transition>
      <template v-if="preferencesButtonPosition.fixed">
        <Preferences class="z-100 fixed bottom-20 right-0" @clear-preferences-and-logout="clearPreferencesAndLogout" />
      </template>
      <VbenBackTop />
    </template>
  </VbenAdminLayout>
</template>