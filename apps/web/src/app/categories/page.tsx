import CategoryCard, { type CategoryCardProps } from '@/components/CategoryCard';

const categories: CategoryCardProps[] = [
  {
    name: 'Cyber Eclipse 2077',
    badge: 'Gaming',
    viewers: '142K',
    liveChannels: '2.4K Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDkkLsCkJGcEFyqd926i-qlWdLy8tXwQkOSt5zSv3vJ3hb3CRpOrsiW1dpCTJl1dQtTeDtWTnqxHT_Utney0RMeYTS4FHdyxNEU9PXd2fPB85B0Xl6XGns3IK3Tz1gAasHWHcxdQWo4S4H97ll3_9wpaRQudRaNUHjzX6St4Xdku2RVDkLqa8_qIp_eCsl9pb-7-mbRlZvqSdoYo0UrvGYUz3zttc7IB-Lpb7YnF27YER11mpIfKVjAfQ',
    alt: 'Gaming Cover',
  },
  {
    name: 'Just Chatting',
    badge: 'IRL',
    viewers: '350K',
    liveChannels: '5.1K Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDXi1FXpb28tSPvQjRjHYvrLwmHq9fov8_u49DdraF4u46VEHq9IFKSbc9QGzb6yxoxH6stWMVVvuE5hYPCnMGvA-G69rgngLLHelYKAK7ZHwDsfT3exV3FjRM-YqfWjAp8KUI7TnOSC13_9uAxubg-GVLjUrYW3JV5ynig_utqI9-LdSUPltt8ygHuMzMB2ivw5hP0xbZU9owe9bN-Q2YS6KwX4B4FOdjM1C825RbFjwa0ySnEKMqejg',
    alt: 'Just Chatting Cover',
  },
  {
    name: 'Music',
    badge: 'Creative',
    viewers: '85K',
    liveChannels: '1.2K Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD7McvLEmuywt5MlRTxhDNVJrsyYOXX87ydwATAq7iLneVQ4GvIZjfmI3sPKY4j4QkCzwDosd827aF5pxNBrY6zZtlmoMYQibKJulkWItIEegRxlK84iOOEzIvWoR5YU58OoELww63fOFrEGEQoRczirzwJdgnL1vWtkSRdM_AG9KpD0SA-BNutJzOqB-oW_FYcfk4uuRJokF7OJaSyQgyG_-E30UhOVLRE3PQYtvzxW7nUmi5Daf2Tmg',
    alt: 'Music Cover',
  },
  {
    name: 'Software & Tech',
    badge: 'Tech',
    viewers: '42K',
    liveChannels: '840 Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuALyNyxp-PEB3a3dx2mZc435K-1ZRdGH2bv2xEmBIFd-FWW7VVEGLvRZJtwdQtcOfKNy5dionhRLeCKwDqDB3L7CQtA1Rr56Qy7IP1u8aHIeVsugimNOkhcPqVp6Q4bPJYU4BEC261PV0ito7OCKv18_IagwtFbBUChTRTecQ_m6WXo_zRZj4dG9P0vqeM_2EtIkeJ4RYh0lwIr_WKOe2OhNXWBdvKiV2C31HW4RRrEG7eexaC0qeqGw',
    alt: 'Technology Cover',
  },
  {
    name: 'Esports Tournaments',
    badge: 'Events',
    viewers: '210K',
    liveChannels: '320 Live Channels',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCT4u_ckKYG3vDqwaF31s0nKtGpf7O4IlhEFykK0b5LuNSmngR6FbKvttC12NbRigRsgdRSBZg0fqAKojpJsiUVh1R-AixyoqZDz-yUhZNeUV8GUSECIIi3o0RJtMr68nveqxy4ji7gPAumiLanGlWiX0xtBGACB71SWXqk0E6Coj_k1ALXWKMbrh99di6F5YSFEdg2Zmh3Idsh7aBVmkdbGvgCZ_iq5pr4_YeDEigx5BwpntYXGPYclg',
    alt: 'Esports Cover',
  },
];

const filters = ['All Categories', 'Games', 'IRL', 'Music', 'Creative'];
export default function Categories() {
  return (
    <div className="flex-1 pt-16 md:pt-0 p-md md:p-lg lg:p-xl max-w-[1920px] mx-auto w-full">
        <h1 className="font-display-lg text-display-lg text-on-surface mb-lg">Categories</h1>

        <div className="flex gap-sm mb-lg overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter, index) => (
            <button
              key={filter}
              type="button"
              className={
                index === 0
                  ? 'px-4 py-1.5 rounded-full bg-surface-variant border border-outline-variant/50 text-on-surface font-label-md text-label-md hover:bg-surface-bright transition-colors whitespace-nowrap'
                  : 'px-4 py-1.5 rounded-full bg-surface border border-outline-variant/30 text-on-surface-variant font-label-md text-label-md hover:border-outline-variant transition-colors whitespace-nowrap'
              }
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-md">
          {categories.map((category) => (
            <CategoryCard
              key={null}
              name={category.name}
              badge={category.badge}
              image={category.image}
              viewers={category.viewers}
              liveChannels={category.liveChannels}
              alt={category.alt}
            />
          ))}
        </div>
    </div>
  );
}
