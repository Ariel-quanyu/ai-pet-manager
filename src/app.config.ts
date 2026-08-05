export default defineAppConfig({
  pages: [
    'features/splash/index', 'features/auth/index', 'features/home/index', 'features/pet/add',
    'features/appointment/clinic/index', 'features/appointment/store/index',
    'features/appointment/pet-select/index', 'features/appointment/success/index'
  ],
  window: { navigationStyle: 'custom', backgroundColor: '#f5fbff', backgroundTextStyle: 'dark' },
  permission: {
    'scope.userLocation': { desc: '用于定位当前城市并按距离展示附近可预约门店' }
  },
  requiredPrivateInfos: ['getLocation']
})
