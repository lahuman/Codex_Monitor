<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" encoding="UTF-8" indent="yes"/>
  <xsl:param name="product"/>
  <xsl:template match="@*|node()">
    <xsl:copy><xsl:apply-templates select="@*|node()"/></xsl:copy>
  </xsl:template>
  <xsl:template match="installer-gui-script">
    <xsl:copy>
      <xsl:apply-templates select="@*"/>
      <title><xsl:value-of select="$product"/></title>
      <xsl:apply-templates select="node()"/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="choice">
    <xsl:copy>
      <xsl:apply-templates select="@*[name() != 'title']"/>
      <xsl:attribute name="title"><xsl:value-of select="$product"/></xsl:attribute>
      <xsl:apply-templates select="node()"/>
    </xsl:copy>
  </xsl:template>
</xsl:stylesheet>
