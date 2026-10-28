import unittest
from sprite_content import Passages


class CompanionPassagesTest(unittest.TestCase):
    def test_section_dates_stay_with_their_own_evidence(self):
        parser = Passages('experience/index.html')
        parser.feed('<main><section id="ecommerce"><p>2023</p><h2>电商教学</h2><h3>我的行动</h3><p>课程答疑。</p></section><section id="livestream"><p>2026</p><h2>直播运营</h2><p>维护观众。</p></section></main>')
        commerce = [r for r in parser.records if r['url'].endswith('#ecommerce')]
        live = [r for r in parser.records if r['url'].endswith('#livestream')]
        self.assertTrue(commerce)
        self.assertTrue(live)
        self.assertNotIn('2026', ' '.join(r['text'] for r in commerce))
        self.assertIn('2026', ' '.join(r['text'] for r in live))

    def test_contact_values_are_evidence_without_copy_button_labels(self):
        parser = Passages('contact/index.html')
        parser.feed('<main><section id="contact"><h2>联系方式</h2><dl><div data-contact-row><dt>邮箱</dt><dd><a href="mailto:person@example.com">person@example.com</a><button>复制邮箱</button></dd></div><div data-contact-row><dt>手机</dt><dd><a href="tel:13800000000">13800000000</a><button>复制号码</button></dd></div></dl></section></main>')
        text = ' '.join(r['text'] for r in parser.records)
        self.assertIn('邮箱：person@example.com', text)
        self.assertIn('手机：13800000000', text)
        self.assertNotIn('复制邮箱', text)
        self.assertNotIn('复制号码', text)


if __name__ == '__main__':
    unittest.main()
