import { Directive, ElementRef, AfterViewInit } from '@angular/core';

@Directive({
  selector: '[reveal]',
  standalone: true,
})
export class RevealDirective implements AfterViewInit {
  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngAfterViewInit() {
    const node = this.el.nativeElement;
    node.classList.add('reveal');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            node.classList.add('in');
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(node);
  }
}
