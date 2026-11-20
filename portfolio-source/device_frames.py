"""One authentic 2025 iPad Pro M5 surround for every portfolio screen capture."""


def device_frame(content, kind='ipad'):
    if kind != 'ipad':
        raise ValueError('Portfolio captures require the 2025 iPad Pro M5 surround')
    return (
        '<span class="device-frame device-frame--ipad" data-device-frame="ipad" data-device-model="ipad-pro-2025">'
        '<img class="ipad-hardware" src="assets/ipad-pro-m5.d67558d91a2d.jpg" alt="" aria-hidden="true" width="3504" height="2784" loading="lazy" decoding="async">'
        '<span class="device-frame__screen">' + content + '</span></span>'
    )
