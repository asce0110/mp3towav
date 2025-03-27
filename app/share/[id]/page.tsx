import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from "@/components/site-header"

// Fetch share data on the server
async function getShareData(id: string) {
  try {
    // Use server-side fetch to get share data
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/share?id=${id}`, {
      next: { revalidate: 60 } // Cache for 1 minute
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch share data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching share data:', error);
    return null;
  }
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const shareData = await getShareData(params.id);
  const isValid = shareData && shareData.success;
  
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F5F7FB] flex flex-col items-center justify-center p-4 md:p-8">
        <div className="container mx-auto max-w-4xl p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="sr-only">MP3 to WAV Shared Conversion</div>
              <h2 className="text-3xl font-bold text-[#2A6FDB] mb-6 text-center">Listen to Converted Audio</h2>
              <p className="text-gray-600 mb-4">
                This audio has been shared with you from our MP3 to WAV converter
              </p>
            </div>
            
            <Card className="w-full max-w-xl bg-white shadow-lg">
              <CardHeader className="bg-[#2A6FDB] text-white">
                <CardTitle className="text-2xl font-bold text-center">
                  Shared WAV File
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-6">
                {isValid ? (
                  <div className="space-y-6 text-center">
                    <div>
                      <h3 className="text-xl font-medium mb-2">
                        {shareData.originalName || 'WAV File'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        This shared file will be available for 24 hours
                      </p>
                    </div>
                    
                    <Button
                      className="bg-[#2A6FDB] hover:bg-[#2A6FDB]/90 w-full"
                      size="lg"
                      asChild
                    >
                      <a href={shareData.downloadUrl} download>
                        <Download className="h-5 w-5 mr-2" />
                        Download WAV File
                      </a>
                    </Button>
                    
                    <div className="pt-4 border-t mt-6">
                      <p className="text-sm text-gray-500 mb-4">
                        Want to convert your own MP3 files?
                      </p>
                      <Button variant="outline" asChild>
                        <Link href="/">
                          Go to MP3 to WAV Converter
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <div className="p-4">
                      <h3 className="text-xl font-medium mb-2 text-red-500">
                        Shared File Not Available
                      </h3>
                      <p className="text-gray-500">
                        This shared file has expired or doesn't exist. Shared files are available for 24 hours.
                      </p>
                    </div>
                    
                    <Button variant="outline" asChild>
                      <Link href="/">
                        Go to MP3 to WAV Converter
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <footer className="mt-8 text-center text-sm text-gray-500">
              <p>MP3 to WAV Converter - Share and convert your audio files</p>
            </footer>
          </div>
        </div>
      </main>
    </>
  );
} 