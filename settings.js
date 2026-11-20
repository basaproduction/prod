/* Вставьте свои публичные ссылки между кавычками. Примеры и запуск — в СТАРТ.txt. */
(function (root) {
  'use strict';
  const settings = {
    behanceUrl: 'https://www.behance.net/taimurazbasa',
    rutubeChannel: '',
    // Необязательно: видео для показа сразу, в том числе при открытии файла с диска.
    // Элемент списка: { url: 'полная ссылка на ролик', title: 'Название', titleEn: 'English title' }
    videos: [
      {
        url: 'https://rutube.ru/video/08467741ae395e2c275157dcf06e3bc2/',
        title: 'Видео 1',
        titleEn: 'Video 1'
      },
      {
        url: 'https://rutube.ru/video/9e04e39286019bf292f30ff1598e99ce/',
        title: 'Видео 2',
        titleEn: 'Video 2'
      }
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = settings;
  else root.BASA_SETTINGS = settings;
})(typeof window === 'undefined' ? globalThis : window);
