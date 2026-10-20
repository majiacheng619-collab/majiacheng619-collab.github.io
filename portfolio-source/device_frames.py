"""Decorative device surrounds for real screen captures."""


def device_frame(content, kind='mac'):
    if kind not in ('mac', 'tablet'):
        raise ValueError('Unknown device surround')
    if kind == 'mac':
        return (
            '<span class="device-frame device-frame--mac" data-device-frame="mac">'
            '<img class="mac-hardware" src="assets/macbook-pro-m5.7929d47ee078.jpg" alt="" aria-hidden="true" width="1960" height="1306" loading="lazy" decoding="async">'
            '<span class="device-frame__screen">' + content + '</span></span>'
        )
    return (
        f'<span class="device-frame device-frame--{kind}" data-device-frame="{kind}">'
        '<span class="device-frame__body">'
        '<span class="device-frame__camera" aria-hidden="true"></span>'
        '<span class="device-frame__screen">' + content + '</span></span>'
        + '</span>'
    )
