"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useTranslations } from 'next-intl';

export function FAQSection() {
  const faqT = useTranslations('faq');
  
  // 问题键列表
  const questionKeys = [
    'howToConvert',
    'storageTime',
    'bestSoftware',
    'improveQuality',
    'fileSize',
    'losslessConversion',
    'onlineVsOffline',
    'windowsConversion',
    'bestSettings',
    'conversionTime'
  ];

  return (
    <section className="w-full max-w-3xl mx-auto mt-8" itemScope itemType="https://schema.org/FAQPage">
      <h2 className="text-2xl font-bold mb-6 text-center">{faqT('title')}</h2>
      <div className="space-y-4">
        {questionKeys.map((key) => {
          const questionT = useTranslations(`faq.questions.${key}`);
          return (
            <div key={key} className="border rounded-lg overflow-hidden">
              {/* Hidden structured data for SEO */}
              <div itemProp="mainEntity" itemScope itemType="https://schema.org/Question">
                <meta itemProp="name" content={questionT('question')} />
                <div itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                  <meta itemProp="text" content={questionT('answer')} />
                </div>
              </div>

              {/* Visible FAQ UI */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="flex w-full justify-between p-4 text-left">
                    <span className="font-medium">{questionT('question')}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 ui-open:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-4 pt-0 border-t">
                  <p className="text-gray-700 dark:text-gray-300">{questionT('answer')}</p>
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </section>
  );
} 